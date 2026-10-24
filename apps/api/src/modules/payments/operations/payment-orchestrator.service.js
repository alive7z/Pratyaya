import mongoose from "mongoose";
import {
  OPERATION_TYPES,
  OPERATION_STATES,
  PAYMENT_STATUS,
  OUTBOX_EVENT_TYPES,
  OUTBOX_STATE,
} from "@pratyaya/shared";
import { AppError } from "../../../lib/errors.js";
import { runFinancialTransaction } from "../../../lib/transaction.js";
import { Payment } from "../payment.model.js";
import { ProviderOperation } from "./provider-operation.model.js";
import { OutboxEvent } from "../outbox-event.model.js";
import { recordPaymentEvent, toPaymentDto } from "../payment.repository.js";
import { createProviderClientService } from "./provider-client.service.js";

function generateClientOperationId(prefix) {
  return `${prefix}-${new mongoose.Types.ObjectId().toString().slice(-16)}`;
}

function now() {
  return new Date();
}

export async function createPaymentOrchestratorService(config, logger) {
  const providerClient = createProviderClientService(config, logger);

  async function initiateAuthorization({ auth, paymentId, idempotencyKey }) {
    return runFinancialTransaction(
      async (session) => {
        const payment = await Payment.findOne({
          _id: paymentId,
          merchantId: auth.merchantId,
        }).session(session);
        if (!payment) {
          throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
        }

        if (payment.status !== PAYMENT_STATUS.QUEUED) {
          throw new AppError(
            409,
            "INVALID_PAYMENT_STATE",
            "Only QUEUED payments can be authorized",
            { status: payment.status },
          );
        }

        const existingOp = await ProviderOperation.findOne({
          paymentId,
          type: OPERATION_TYPES.AUTHORIZE,
          state: {
            $in: [
              OPERATION_STATES.PENDING,
              OPERATION_STATES.IN_FLIGHT,
              OPERATION_STATES.UNKNOWN,
            ],
          },
        })
          .session(session)
          .lean();

        if (existingOp) {
          return {
            providerOperation: existingOp,
            payment: toPaymentDto(payment),
            alreadyInProgress: true,
          };
        }

        const clientOperationId = generateClientOperationId("auth");
        const providerIdempotencyKey = `${idempotencyKey}-auth`;

        const [providerOp] = await ProviderOperation.create(
          [
            {
              paymentId,
              merchantId: auth.merchantId,
              type: OPERATION_TYPES.AUTHORIZE,
              providerOperationId: clientOperationId,
              clientOperationId,
              amountMinor: payment.amountMinor,
              currency: payment.currency,
              state: OPERATION_STATES.PENDING,
              requestPayload: {
                clientOperationId,
                amountMinor: payment.amountMinor.toString(),
                currency: payment.currency,
                paymentMethod: { type: "card", token: "tok_demo_123" },
                description: payment.description,
                metadata: payment.metadata,
              },
              idempotencyKey: providerIdempotencyKey,
              isDemo: auth.isDemo,
            },
          ],
          { session },
        );

        const updatedPayment = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            merchantId: auth.merchantId,
            status: PAYMENT_STATUS.QUEUED,
            version: payment.version,
          },
          {
            $set: { status: PAYMENT_STATUS.AUTHORIZING },
            $inc: { version: 1 },
          },
          { returnDocument: "after", session },
        );

        if (!updatedPayment) {
          throw new AppError(
            409,
            "PAYMENT_CONCURRENCY_CONFLICT",
            "Payment state changed during authorization initiation",
          );
        }

        await recordPaymentEvent(
          {
            paymentId: payment._id,
            merchantId: auth.merchantId,
            eventType: "payment.authorizing",
            fromStatus: PAYMENT_STATUS.QUEUED,
            toStatus: PAYMENT_STATUS.AUTHORIZING,
            actorUserId: auth.user?._id ?? auth.userId,
            actorRole: auth.role,
            summary: "Authorization requested",
            metadata: {
              clientOperationId,
              providerOperationId: providerOp._id,
            },
            isDemo: auth.isDemo,
          },
          session,
        );

        await OutboxEvent.create(
          [
            {
              merchantId: auth.merchantId,
              aggregateType: "payment",
              aggregateId: payment._id,
              eventType: OUTBOX_EVENT_TYPES.PAYMENT_AUTHORIZE_REQUESTED,
              payload: {
                paymentId: String(payment._id),
                merchantId: String(auth.merchantId),
                providerOperationId: String(providerOp._id),
                clientOperationId,
              },
              state: OUTBOX_STATE.PENDING,
              availableAt: now(),
              isDemo: auth.isDemo,
            },
          ],
          { session },
        );

        return {
          providerOperation: providerOp,
          payment: toPaymentDto(updatedPayment),
          alreadyInProgress: false,
        };
      },
      {
        reconcile: async () => {
          const op = await ProviderOperation.findOne({
            paymentId,
            type: OPERATION_TYPES.AUTHORIZE,
          }).lean();
          return op ? { providerOperation: op } : null;
        },
      },
    );
  }

  async function processAuthorization({ providerOperationId, auth }) {
    return runFinancialTransaction(
      async (session) => {
        const providerOp =
          await ProviderOperation.findById(providerOperationId).session(
            session,
          );
        if (!providerOp) {
          throw new AppError(
            404,
            "PROVIDER_OPERATION_NOT_FOUND",
            "Provider operation not found",
          );
        }

        if (
          providerOp.state !== OPERATION_STATES.PENDING &&
          providerOp.state !== OPERATION_STATES.IN_FLIGHT
        ) {
          return { providerOperation: providerOp, alreadyProcessed: true };
        }

        const payment = await Payment.findOne({
          _id: providerOp.paymentId,
          merchantId: auth.merchantId,
        }).session(session);
        if (!payment) {
          throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
        }

        await ProviderOperation.updateOne(
          { _id: providerOp._id },
          { $set: { state: OPERATION_STATES.IN_FLIGHT, lastAttemptAt: now() } },
          { session },
        );

        try {
          const response = await providerClient.authorize({
            clientOperationId: providerOp.clientOperationId,
            amountMinor: providerOp.amountMinor.toString(),
            currency: providerOp.currency,
            paymentMethod: providerOp.requestPayload.paymentMethod,
            description: providerOp.requestPayload.description,
            metadata: providerOp.requestPayload.metadata,
            idempotencyKey: providerOp.idempotencyKey,
            merchantId: String(auth.merchantId),
          });

          const providerResponse = response.data;
          const providerOperationIdFromProvider = providerResponse.operationId;
          const providerStatus = providerResponse.status;
          const providerReference = providerResponse.providerReference;

          await ProviderOperation.updateOne(
            { _id: providerOp._id },
            {
              $set: {
                providerOperationId: providerOperationIdFromProvider,
                responsePayload: providerResponse,
                providerReference,
                attemptCount: providerOp.attemptCount + 1,
                lastAttemptAt: now(),
              },
            },
            { session },
          );

          if (providerStatus === "SUCCEEDED") {
            const updatedPayment = await Payment.findOneAndUpdate(
              {
                _id: payment._id,
                merchantId: auth.merchantId,
                status: PAYMENT_STATUS.AUTHORIZING,
                version: payment.version,
              },
              {
                $set: { status: PAYMENT_STATUS.AUTHORIZED },
                $inc: { version: 1 },
              },
              { returnDocument: "after", session },
            );

            if (!updatedPayment) {
              throw new AppError(
                409,
                "PAYMENT_CONCURRENCY_CONFLICT",
                "Payment state changed during authorization completion",
              );
            }

            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.SUCCEEDED,
                  processingCompletedAt: now(),
                },
              },
              { session },
            );

            await recordPaymentEvent(
              {
                paymentId: payment._id,
                merchantId: auth.merchantId,
                eventType: "payment.authorized",
                fromStatus: PAYMENT_STATUS.AUTHORIZING,
                toStatus: PAYMENT_STATUS.AUTHORIZED,
                actorRole: "provider",
                summary: "Authorization succeeded",
                metadata: {
                  providerOperationId: providerOperationIdFromProvider,
                  providerReference,
                },
                isDemo: auth.isDemo,
              },
              session,
            );

            await OutboxEvent.create(
              [
                {
                  merchantId: auth.merchantId,
                  aggregateType: "payment",
                  aggregateId: payment._id,
                  eventType: OUTBOX_EVENT_TYPES.PAYMENT_CAPTURE_REQUESTED,
                  payload: {
                    paymentId: String(payment._id),
                    merchantId: String(auth.merchantId),
                    amountMinor: payment.amountMinor.toString(),
                    currency: payment.currency,
                    mode: "automatic",
                  },
                  state: OUTBOX_STATE.PENDING,
                  availableAt: now(),
                  isDemo: auth.isDemo,
                },
              ],
              { session },
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: toPaymentDto(updatedPayment),
            };
          }

          if (providerStatus === "DECLINED") {
            const updatedPayment = await Payment.findOneAndUpdate(
              {
                _id: payment._id,
                merchantId: auth.merchantId,
                status: PAYMENT_STATUS.AUTHORIZING,
                version: payment.version,
              },
              {
                $set: {
                  status: PAYMENT_STATUS.FAILED,
                  statusReason:
                    providerResponse.statusReason ?? "Authorization declined",
                },
                $inc: { version: 1 },
              },
              { returnDocument: "after", session },
            );

            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.FAILED,
                  stateReason: providerResponse.statusReason,
                  processingCompletedAt: now(),
                },
              },
              { session },
            );

            await recordPaymentEvent(
              {
                paymentId: payment._id,
                merchantId: auth.merchantId,
                eventType: "payment.failed",
                fromStatus: PAYMENT_STATUS.AUTHORIZING,
                toStatus: PAYMENT_STATUS.FAILED,
                actorRole: "provider",
                summary: "Authorization declined",
                metadata: {
                  providerOperationId: providerOperationIdFromProvider,
                  reason: providerResponse.statusReason,
                },
                isDemo: auth.isDemo,
              },
              session,
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: toPaymentDto(updatedPayment),
            };
          }

          if (providerStatus === "UNKNOWN_TO_CLIENT" || response.timeout) {
            const updatedPayment = await Payment.findOneAndUpdate(
              {
                _id: payment._id,
                merchantId: auth.merchantId,
                status: PAYMENT_STATUS.AUTHORIZING,
                version: payment.version,
              },
              {
                $set: {
                  status: PAYMENT_STATUS.UNKNOWN,
                  statusReason: "Provider timeout - outcome unknown",
                },
                $inc: { version: 1 },
              },
              { returnDocument: "after", session },
            );

            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.UNKNOWN,
                  stateReason: "Provider timeout - outcome unknown",
                  processingCompletedAt: now(),
                  faultInjected: providerResponse.faultInjected,
                },
              },
              { session },
            );

            await recordPaymentEvent(
              {
                paymentId: payment._id,
                merchantId: auth.merchantId,
                eventType: "payment.unknown",
                fromStatus: PAYMENT_STATUS.AUTHORIZING,
                toStatus: PAYMENT_STATUS.UNKNOWN,
                actorRole: "provider",
                summary: "Authorization outcome unknown - provider timeout",
                metadata: {
                  providerOperationId: providerOperationIdFromProvider,
                },
                isDemo: auth.isDemo,
              },
              session,
            );

            await OutboxEvent.create(
              [
                {
                  merchantId: auth.merchantId,
                  aggregateType: "payment",
                  aggregateId: payment._id,
                  eventType:
                    OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED,
                  payload: {
                    paymentId: String(payment._id),
                    merchantId: String(auth.merchantId),
                    reason: "authorization_timeout",
                  },
                  state: OUTBOX_STATE.PENDING,
                  availableAt: now(),
                  isDemo: auth.isDemo,
                },
              ],
              { session },
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: toPaymentDto(updatedPayment),
            };
          }

          throw new AppError(
            502,
            "PROVIDER_UNEXPECTED_STATUS",
            `Unexpected provider status: ${providerStatus}`,
          );
        } catch (error) {
          if (error instanceof AppError && error.code === "PROVIDER_TIMEOUT") {
            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.UNKNOWN,
                  stateReason: "Provider timeout - outcome unknown",
                  processingCompletedAt: now(),
                  faultInjected: "timeout",
                },
              },
              { session },
            );

            await Payment.findOneAndUpdate(
              {
                _id: payment._id,
                merchantId: auth.merchantId,
                status: PAYMENT_STATUS.AUTHORIZING,
              },
              {
                $set: {
                  status: PAYMENT_STATUS.UNKNOWN,
                  statusReason: "Provider timeout - outcome unknown",
                },
                $inc: { version: 1 },
              },
              { session },
            );

            await OutboxEvent.create(
              [
                {
                  merchantId: auth.merchantId,
                  aggregateType: "payment",
                  aggregateId: payment._id,
                  eventType:
                    OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED,
                  payload: {
                    paymentId: String(payment._id),
                    merchantId: String(auth.merchantId),
                    reason: "authorization_timeout",
                  },
                  state: OUTBOX_STATE.PENDING,
                  availableAt: now(),
                  isDemo: auth.isDemo,
                },
              ],
              { session },
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: await Payment.findById(payment._id)
                .session(session)
                .lean()
                .then(toPaymentDto),
            };
          }
          throw error;
        }
      },
      {
        reconcile: async () => {
          const op =
            await ProviderOperation.findById(providerOperationId).lean();
          return op ? { providerOperation: op } : null;
        },
      },
    );
  }

  async function initiateCapture({
    auth,
    paymentId,
    idempotencyKey,
    mode = "automatic",
  }) {
    return runFinancialTransaction(
      async (session) => {
        const payment = await Payment.findOne({
          _id: paymentId,
          merchantId: auth.merchantId,
        }).session(session);
        if (!payment) {
          throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
        }

        if (payment.status !== PAYMENT_STATUS.AUTHORIZED) {
          throw new AppError(
            409,
            "INVALID_PAYMENT_STATE",
            "Only AUTHORIZED payments can be captured",
            { status: payment.status },
          );
        }

        const existingOp = await ProviderOperation.findOne({
          paymentId,
          type: OPERATION_TYPES.CAPTURE,
          state: {
            $in: [
              OPERATION_STATES.PENDING,
              OPERATION_STATES.IN_FLIGHT,
              OPERATION_STATES.UNKNOWN,
            ],
          },
        })
          .session(session)
          .lean();

        if (existingOp) {
          return {
            providerOperation: existingOp,
            payment: toPaymentDto(payment),
            alreadyInProgress: true,
          };
        }

        const clientOperationId = generateClientOperationId("cap");
        const providerIdempotencyKey = `${idempotencyKey}-capture`;

        const authOp = await ProviderOperation.findOne({
          paymentId,
          type: OPERATION_TYPES.AUTHORIZE,
          state: OPERATION_STATES.SUCCEEDED,
        })
          .session(session)
          .lean();

        if (!authOp || !authOp.providerOperationId) {
          throw new AppError(
            409,
            "AUTHORIZATION_NOT_CONFIRMED",
            "No confirmed authorization found for capture",
          );
        }

        const [providerOp] = await ProviderOperation.create(
          [
            {
              paymentId,
              merchantId: auth.merchantId,
              type: OPERATION_TYPES.CAPTURE,
              providerOperationId: clientOperationId,
              clientOperationId,
              amountMinor: payment.amountMinor,
              currency: payment.currency,
              state: OPERATION_STATES.PENDING,
              requestPayload: {
                clientOperationId,
                authorizationOperationId: authOp.providerOperationId,
                amountMinor: payment.amountMinor.toString(),
                currency: payment.currency,
                metadata: payment.metadata,
              },
              idempotencyKey: providerIdempotencyKey,
              isDemo: auth.isDemo,
            },
          ],
          { session },
        );

        const updatedPayment = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            merchantId: auth.merchantId,
            status: PAYMENT_STATUS.AUTHORIZED,
            version: payment.version,
          },
          {
            $set: { status: PAYMENT_STATUS.CAPTURING },
            $inc: { version: 1 },
          },
          { returnDocument: "after", session },
        );

        if (!updatedPayment) {
          throw new AppError(
            409,
            "PAYMENT_CONCURRENCY_CONFLICT",
            "Payment state changed during capture initiation",
          );
        }

        await recordPaymentEvent(
          {
            paymentId: payment._id,
            merchantId: auth.merchantId,
            eventType: "payment.capturing",
            fromStatus: PAYMENT_STATUS.AUTHORIZED,
            toStatus: PAYMENT_STATUS.CAPTURING,
            actorUserId: auth.user?._id ?? auth.userId,
            actorRole: auth.role,
            summary: `Capture requested (${mode})`,
            metadata: {
              clientOperationId,
              providerOperationId: providerOp._id,
            },
            isDemo: auth.isDemo,
          },
          session,
        );

        await OutboxEvent.create(
          [
            {
              merchantId: auth.merchantId,
              aggregateType: "payment",
              aggregateId: payment._id,
              eventType: OUTBOX_EVENT_TYPES.PAYMENT_CAPTURE_REQUESTED,
              payload: {
                paymentId: String(payment._id),
                merchantId: String(auth.merchantId),
                providerOperationId: String(providerOp._id),
                clientOperationId,
                mode,
              },
              state: OUTBOX_STATE.PENDING,
              availableAt: now(),
              isDemo: auth.isDemo,
            },
          ],
          { session },
        );

        return {
          providerOperation: providerOp,
          payment: toPaymentDto(updatedPayment),
          alreadyInProgress: false,
        };
      },
      {
        reconcile: async () => {
          const op = await ProviderOperation.findOne({
            paymentId,
            type: OPERATION_TYPES.CAPTURE,
          }).lean();
          return op ? { providerOperation: op } : null;
        },
      },
    );
  }

  async function processCapture({ providerOperationId, auth }) {
    return runFinancialTransaction(
      async (session) => {
        const providerOp =
          await ProviderOperation.findById(providerOperationId).session(
            session,
          );
        if (!providerOp) {
          throw new AppError(
            404,
            "PROVIDER_OPERATION_NOT_FOUND",
            "Provider operation not found",
          );
        }

        if (
          providerOp.state !== OPERATION_STATES.PENDING &&
          providerOp.state !== OPERATION_STATES.IN_FLIGHT
        ) {
          return { providerOperation: providerOp, alreadyProcessed: true };
        }

        const payment = await Payment.findOne({
          _id: providerOp.paymentId,
          merchantId: auth.merchantId,
        }).session(session);
        if (!payment) {
          throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
        }

        await ProviderOperation.updateOne(
          { _id: providerOp._id },
          { $set: { state: OPERATION_STATES.IN_FLIGHT, lastAttemptAt: now() } },
          { session },
        );

        try {
          const response = await providerClient.capture({
            clientOperationId: providerOp.clientOperationId,
            authorizationOperationId:
              providerOp.requestPayload.authorizationOperationId,
            amountMinor: providerOp.amountMinor.toString(),
            currency: providerOp.currency,
            idempotencyKey: providerOp.idempotencyKey,
            merchantId: String(auth.merchantId),
            metadata: providerOp.requestPayload.metadata,
          });

          const providerResponse = response.data;
          const providerOperationIdFromProvider = providerResponse.operationId;
          const providerStatus = providerResponse.status;
          const providerReference = providerResponse.providerReference;

          await ProviderOperation.updateOne(
            { _id: providerOp._id },
            {
              $set: {
                providerOperationId: providerOperationIdFromProvider,
                responsePayload: providerResponse,
                providerReference,
                attemptCount: providerOp.attemptCount + 1,
                lastAttemptAt: now(),
              },
            },
            { session },
          );

          if (providerStatus === "SUCCEEDED") {
            const { confirmTrustedCapture } =
              await import("../ledger/payment-ledger.service.js");
            const result = await confirmTrustedCapture({
              merchantId: auth.merchantId,
              paymentId: payment._id,
              providerEventId: providerOperationIdFromProvider,
              actor: "provider",
              requestId: providerOp.idempotencyKey,
              isDemo: auth.isDemo,
            });

            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.SUCCEEDED,
                  processingCompletedAt: now(),
                },
              },
              { session },
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: result.payment,
              journal: result.journal,
            };
          }

          if (providerStatus === "DECLINED") {
            await Payment.findOneAndUpdate(
              {
                _id: payment._id,
                merchantId: auth.merchantId,
                status: PAYMENT_STATUS.CAPTURING,
              },
              {
                $set: {
                  status: PAYMENT_STATUS.FAILED,
                  statusReason:
                    providerResponse.statusReason ?? "Capture declined",
                },
                $inc: { version: 1 },
              },
              { session },
            );

            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.FAILED,
                  stateReason: providerResponse.statusReason,
                  processingCompletedAt: now(),
                },
              },
              { session },
            );

            await recordPaymentEvent(
              {
                paymentId: payment._id,
                merchantId: auth.merchantId,
                eventType: "payment.capture.failed",
                fromStatus: PAYMENT_STATUS.CAPTURING,
                toStatus: PAYMENT_STATUS.FAILED,
                actorRole: "provider",
                summary: "Capture declined",
                metadata: {
                  providerOperationId: providerOperationIdFromProvider,
                  reason: providerResponse.statusReason,
                },
                isDemo: auth.isDemo,
              },
              session,
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: await Payment.findById(payment._id)
                .session(session)
                .lean()
                .then(toPaymentDto),
            };
          }

          if (providerStatus === "UNKNOWN_TO_CLIENT" || response.timeout) {
            await Payment.findOneAndUpdate(
              {
                _id: payment._id,
                merchantId: auth.merchantId,
                status: PAYMENT_STATUS.CAPTURING,
              },
              {
                $set: {
                  status: PAYMENT_STATUS.UNKNOWN,
                  statusReason: "Provider timeout - outcome unknown",
                },
                $inc: { version: 1 },
              },
              { session },
            );

            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.UNKNOWN,
                  stateReason: "Provider timeout - outcome unknown",
                  processingCompletedAt: now(),
                  faultInjected: providerResponse.faultInjected,
                },
              },
              { session },
            );

            await recordPaymentEvent(
              {
                paymentId: payment._id,
                merchantId: auth.merchantId,
                eventType: "payment.capture.unknown",
                fromStatus: PAYMENT_STATUS.CAPTURING,
                toStatus: PAYMENT_STATUS.UNKNOWN,
                actorRole: "provider",
                summary: "Capture outcome unknown - provider timeout",
                metadata: {
                  providerOperationId: providerOperationIdFromProvider,
                },
                isDemo: auth.isDemo,
              },
              session,
            );

            await OutboxEvent.create(
              [
                {
                  merchantId: auth.merchantId,
                  aggregateType: "payment",
                  aggregateId: payment._id,
                  eventType:
                    OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED,
                  payload: {
                    paymentId: String(payment._id),
                    merchantId: String(auth.merchantId),
                    reason: "capture_timeout",
                  },
                  state: OUTBOX_STATE.PENDING,
                  availableAt: now(),
                  isDemo: auth.isDemo,
                },
              ],
              { session },
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: await Payment.findById(payment._id)
                .session(session)
                .lean()
                .then(toPaymentDto),
            };
          }

          throw new AppError(
            502,
            "PROVIDER_UNEXPECTED_STATUS",
            `Unexpected provider status: ${providerStatus}`,
          );
        } catch (error) {
          if (error instanceof AppError && error.code === "PROVIDER_TIMEOUT") {
            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.UNKNOWN,
                  stateReason: "Provider timeout - outcome unknown",
                  processingCompletedAt: now(),
                  faultInjected: "timeout",
                },
              },
              { session },
            );

            await Payment.findOneAndUpdate(
              {
                _id: payment._id,
                merchantId: auth.merchantId,
                status: PAYMENT_STATUS.CAPTURING,
              },
              {
                $set: {
                  status: PAYMENT_STATUS.UNKNOWN,
                  statusReason: "Provider timeout - outcome unknown",
                },
                $inc: { version: 1 },
              },
              { session },
            );

            await OutboxEvent.create(
              [
                {
                  merchantId: auth.merchantId,
                  aggregateType: "payment",
                  aggregateId: payment._id,
                  eventType:
                    OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED,
                  payload: {
                    paymentId: String(payment._id),
                    merchantId: String(auth.merchantId),
                    reason: "capture_timeout",
                  },
                  state: OUTBOX_STATE.PENDING,
                  availableAt: now(),
                  isDemo: auth.isDemo,
                },
              ],
              { session },
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: await Payment.findById(payment._id)
                .session(session)
                .lean()
                .then(toPaymentDto),
            };
          }
          throw error;
        }
      },
      {
        reconcile: async () => {
          const op =
            await ProviderOperation.findById(providerOperationId).lean();
          return op ? { providerOperation: op } : null;
        },
      },
    );
  }

  async function initiateRefund({
    auth,
    paymentId,
    amountMinor,
    reason,
    idempotencyKey,
  }) {
    return runFinancialTransaction(
      async (session) => {
        const payment = await Payment.findOne({
          _id: paymentId,
          merchantId: auth.merchantId,
        }).session(session);
        if (!payment) {
          throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
        }

        const allowedStatuses = [
          PAYMENT_STATUS.CAPTURED,
          PAYMENT_STATUS.REFUND_PENDING,
          PAYMENT_STATUS.PARTIALLY_REFUNDED,
        ];
        if (!allowedStatuses.includes(payment.status)) {
          throw new AppError(
            409,
            "INVALID_PAYMENT_STATE",
            "Payment must be captured to process refunds",
            { status: payment.status },
          );
        }

        const capturedMinor = BigInt(
          payment.capturedMinor ?? payment.amountMinor,
        );
        const remainingRefundable = capturedMinor - payment.refundedMinor;
        const refundAmount = BigInt(amountMinor);

        if (refundAmount <= 0n) {
          throw new AppError(
            422,
            "INVALID_REFUND_AMOUNT",
            "Refund amount must be positive",
          );
        }
        if (refundAmount > remainingRefundable) {
          throw new AppError(
            409,
            "REFUND_EXCEEDS_CAPTURE",
            "Refund amount exceeds available captured funds",
            { refundableMinor: remainingRefundable.toString() },
          );
        }

        const captureOp = await ProviderOperation.findOne({
          paymentId,
          type: OPERATION_TYPES.CAPTURE,
          state: OPERATION_STATES.SUCCEEDED,
        })
          .session(session)
          .lean();

        if (!captureOp || !captureOp.providerOperationId) {
          throw new AppError(
            409,
            "CAPTURE_NOT_CONFIRMED",
            "No confirmed capture found for refund",
          );
        }

        const clientOperationId = generateClientOperationId("ref");
        const providerIdempotencyKey = `${idempotencyKey}-refund`;

        const [providerOp] = await ProviderOperation.create(
          [
            {
              paymentId,
              merchantId: auth.merchantId,
              type: OPERATION_TYPES.REFUND,
              providerOperationId: clientOperationId,
              clientOperationId,
              amountMinor: refundAmount,
              currency: payment.currency,
              state: OPERATION_STATES.PENDING,
              requestPayload: {
                clientOperationId,
                captureOperationId: captureOp.providerOperationId,
                amountMinor: refundAmount.toString(),
                currency: payment.currency,
                reason,
                metadata: payment.metadata,
              },
              idempotencyKey: providerIdempotencyKey,
              isDemo: auth.isDemo,
            },
          ],
          { session },
        );

        const newRefunded = payment.refundedMinor + refundAmount;
        const nextStatus =
          newRefunded === capturedMinor
            ? PAYMENT_STATUS.REFUNDED
            : PAYMENT_STATUS.REFUND_PENDING;

        const updatedPayment = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            merchantId: auth.merchantId,
            version: payment.version,
            refundedMinor: payment.refundedMinor,
            status: { $in: allowedStatuses },
          },
          {
            $set: { status: nextStatus, refundedMinor: newRefunded },
            $inc: { version: 1 },
          },
          { returnDocument: "after", session },
        );

        if (!updatedPayment) {
          throw new AppError(
            409,
            "PAYMENT_CONCURRENCY_CONFLICT",
            "Payment state changed during refund initiation",
          );
        }

        await recordPaymentEvent(
          {
            paymentId: payment._id,
            merchantId: auth.merchantId,
            eventType: "payment.refund.requested",
            fromStatus: payment.status,
            toStatus: nextStatus,
            actorUserId: auth.user?._id ?? auth.userId,
            actorRole: auth.role,
            summary: `Refund requested: ${refundAmount.toString()} ${payment.currency}`,
            metadata: {
              clientOperationId,
              providerOperationId: providerOp._id,
              amountMinor: refundAmount.toString(),
              reason,
            },
            isDemo: auth.isDemo,
          },
          session,
        );

        await OutboxEvent.create(
          [
            {
              merchantId: auth.merchantId,
              aggregateType: "payment",
              aggregateId: payment._id,
              eventType: OUTBOX_EVENT_TYPES.PAYMENT_REFUND_REQUESTED,
              payload: {
                paymentId: String(payment._id),
                merchantId: String(auth.merchantId),
                providerOperationId: String(providerOp._id),
                clientOperationId,
                amountMinor: refundAmount.toString(),
                reason,
              },
              state: OUTBOX_STATE.PENDING,
              availableAt: now(),
              isDemo: auth.isDemo,
            },
          ],
          { session },
        );

        return {
          providerOperation: providerOp,
          payment: toPaymentDto(updatedPayment),
          alreadyInProgress: false,
        };
      },
      {
        reconcile: async () => {
          const op = await ProviderOperation.findOne({
            paymentId,
            type: OPERATION_TYPES.REFUND,
          }).lean();
          return op ? { providerOperation: op } : null;
        },
      },
    );
  }

  async function processRefund({ providerOperationId, auth }) {
    return runFinancialTransaction(
      async (session) => {
        const providerOp =
          await ProviderOperation.findById(providerOperationId).session(
            session,
          );
        if (!providerOp) {
          throw new AppError(
            404,
            "PROVIDER_OPERATION_NOT_FOUND",
            "Provider operation not found",
          );
        }

        if (
          providerOp.state !== OPERATION_STATES.PENDING &&
          providerOp.state !== OPERATION_STATES.IN_FLIGHT
        ) {
          return { providerOperation: providerOp, alreadyProcessed: true };
        }

        const payment = await Payment.findOne({
          _id: providerOp.paymentId,
          merchantId: auth.merchantId,
        }).session(session);
        if (!payment) {
          throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
        }

        await ProviderOperation.updateOne(
          { _id: providerOp._id },
          { $set: { state: OPERATION_STATES.IN_FLIGHT, lastAttemptAt: now() } },
          { session },
        );

        try {
          const response = await providerClient.refund({
            clientOperationId: providerOp.clientOperationId,
            captureOperationId: providerOp.requestPayload.captureOperationId,
            amountMinor: providerOp.amountMinor.toString(),
            currency: providerOp.currency,
            idempotencyKey: providerOp.idempotencyKey,
            merchantId: String(auth.merchantId),
            reason: providerOp.requestPayload.reason,
            metadata: providerOp.requestPayload.metadata,
          });

          const providerResponse = response.data;
          const providerOperationIdFromProvider = providerResponse.operationId;
          const providerStatus = providerResponse.status;
          const providerReference = providerResponse.providerReference;

          await ProviderOperation.updateOne(
            { _id: providerOp._id },
            {
              $set: {
                providerOperationId: providerOperationIdFromProvider,
                responsePayload: providerResponse,
                providerReference,
                attemptCount: providerOp.attemptCount + 1,
                lastAttemptAt: now(),
              },
            },
            { session },
          );

          if (providerStatus === "SUCCEEDED") {
            const { confirmTrustedRefund } =
              await import("../ledger/payment-ledger.service.js");
            const result = await confirmTrustedRefund({
              merchantId: auth.merchantId,
              paymentId: payment._id,
              providerEventId: providerOperationIdFromProvider,
              amountMinor: providerOp.amountMinor.toString(),
              actor: "provider",
              requestId: providerOp.idempotencyKey,
              isDemo: auth.isDemo,
            });

            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.SUCCEEDED,
                  processingCompletedAt: now(),
                },
              },
              { session },
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: result.payment,
              journal: result.journal,
            };
          }

          if (providerStatus === "DECLINED") {
            const capturedMinor = BigInt(
              payment.capturedMinor ?? payment.amountMinor,
            );
            const newRefunded = payment.refundedMinor - providerOp.amountMinor;
            const nextStatus =
              newRefunded === 0n
                ? PAYMENT_STATUS.CAPTURED
                : newRefunded === capturedMinor
                  ? PAYMENT_STATUS.REFUNDED
                  : PAYMENT_STATUS.PARTIALLY_REFUNDED;

            await Payment.findOneAndUpdate(
              { _id: payment._id, merchantId: auth.merchantId },
              {
                $set: { status: nextStatus, refundedMinor: newRefunded },
                $inc: { version: 1 },
              },
              { session },
            );

            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.FAILED,
                  stateReason: providerResponse.statusReason,
                  processingCompletedAt: now(),
                },
              },
              { session },
            );

            await recordPaymentEvent(
              {
                paymentId: payment._id,
                merchantId: auth.merchantId,
                eventType: "payment.refund.failed",
                fromStatus: payment.status,
                toStatus: nextStatus,
                actorRole: "provider",
                summary: "Refund declined",
                metadata: {
                  providerOperationId: providerOperationIdFromProvider,
                  reason: providerResponse.statusReason,
                },
                isDemo: auth.isDemo,
              },
              session,
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: await Payment.findById(payment._id)
                .session(session)
                .lean()
                .then(toPaymentDto),
            };
          }

          if (providerStatus === "UNKNOWN_TO_CLIENT" || response.timeout) {
            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.UNKNOWN,
                  stateReason: "Provider timeout - outcome unknown",
                  processingCompletedAt: now(),
                  faultInjected: providerResponse.faultInjected,
                },
              },
              { session },
            );

            await recordPaymentEvent(
              {
                paymentId: payment._id,
                merchantId: auth.merchantId,
                eventType: "payment.refund.unknown",
                fromStatus: payment.status,
                toStatus: payment.status,
                actorRole: "provider",
                summary: "Refund outcome unknown - provider timeout",
                metadata: {
                  providerOperationId: providerOperationIdFromProvider,
                },
                isDemo: auth.isDemo,
              },
              session,
            );

            await OutboxEvent.create(
              [
                {
                  merchantId: auth.merchantId,
                  aggregateType: "payment",
                  aggregateId: payment._id,
                  eventType:
                    OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED,
                  payload: {
                    paymentId: String(payment._id),
                    merchantId: String(auth.merchantId),
                    reason: "refund_timeout",
                  },
                  state: OUTBOX_STATE.PENDING,
                  availableAt: now(),
                  isDemo: auth.isDemo,
                },
              ],
              { session },
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: toPaymentDto(payment),
            };
          }

          throw new AppError(
            502,
            "PROVIDER_UNEXPECTED_STATUS",
            `Unexpected provider status: ${providerStatus}`,
          );
        } catch (error) {
          if (error instanceof AppError && error.code === "PROVIDER_TIMEOUT") {
            await ProviderOperation.updateOne(
              { _id: providerOp._id },
              {
                $set: {
                  state: OPERATION_STATES.UNKNOWN,
                  stateReason: "Provider timeout - outcome unknown",
                  processingCompletedAt: now(),
                  faultInjected: "timeout",
                },
              },
              { session },
            );

            await OutboxEvent.create(
              [
                {
                  merchantId: auth.merchantId,
                  aggregateType: "payment",
                  aggregateId: payment._id,
                  eventType:
                    OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED,
                  payload: {
                    paymentId: String(payment._id),
                    merchantId: String(auth.merchantId),
                    reason: "refund_timeout",
                  },
                  state: OUTBOX_STATE.PENDING,
                  availableAt: now(),
                  isDemo: auth.isDemo,
                },
              ],
              { session },
            );

            return {
              providerOperation: await ProviderOperation.findById(
                providerOp._id,
              )
                .session(session)
                .lean(),
              payment: toPaymentDto(payment),
            };
          }
          throw error;
        }
      },
      {
        reconcile: async () => {
          const op =
            await ProviderOperation.findById(providerOperationId).lean();
          return op ? { providerOperation: op } : null;
        },
      },
    );
  }

  async function reconcileAuthorization({ providerOperationId, auth }) {
    const providerOp =
      await ProviderOperation.findById(providerOperationId).lean();
    if (!providerOp || !providerOp.providerOperationId) {
      throw new AppError(
        404,
        "PROVIDER_OPERATION_NOT_FOUND",
        "Provider operation not found or not yet dispatched",
      );
    }

    const response = await providerClient.getOperation({
      operationId: providerOp.providerOperationId,
      idempotencyKey: `reconcile-${providerOp._id}`,
    });

    const providerResponse = response.data;
    const providerStatus = providerResponse.status;

    if (providerStatus === "SUCCEEDED") {
      return processAuthorization({ providerOperationId, auth });
    }
    if (providerStatus === "DECLINED") {
      return processAuthorization({ providerOperationId, auth });
    }
    if (
      providerStatus === "UNKNOWN_TO_CLIENT" ||
      providerStatus === "PROCESSING" ||
      providerStatus === "RECEIVED"
    ) {
      return {
        providerOperation: providerOp,
        status: "UNRESOLVED",
        message: "Provider operation still processing or unknown",
      };
    }

    throw new AppError(
      502,
      "PROVIDER_UNEXPECTED_STATUS",
      `Unexpected provider status during reconciliation: ${providerStatus}`,
    );
  }

  async function reconcileCapture({ providerOperationId, auth }) {
    const providerOp =
      await ProviderOperation.findById(providerOperationId).lean();
    if (!providerOp || !providerOp.providerOperationId) {
      throw new AppError(
        404,
        "PROVIDER_OPERATION_NOT_FOUND",
        "Provider operation not found or not yet dispatched",
      );
    }

    const response = await providerClient.getOperation({
      operationId: providerOp.providerOperationId,
      idempotencyKey: `reconcile-${providerOp._id}`,
    });

    const providerResponse = response.data;
    const providerStatus = providerResponse.status;

    if (providerStatus === "SUCCEEDED") {
      return processCapture({ providerOperationId, auth });
    }
    if (providerStatus === "DECLINED") {
      return processCapture({ providerOperationId, auth });
    }
    if (
      providerStatus === "UNKNOWN_TO_CLIENT" ||
      providerStatus === "PROCESSING" ||
      providerStatus === "RECEIVED"
    ) {
      return {
        providerOperation: providerOp,
        status: "UNRESOLVED",
        message: "Provider operation still processing or unknown",
      };
    }

    throw new AppError(
      502,
      "PROVIDER_UNEXPECTED_STATUS",
      `Unexpected provider status during reconciliation: ${providerStatus}`,
    );
  }

  async function reconcileRefund({ providerOperationId, auth }) {
    const providerOp =
      await ProviderOperation.findById(providerOperationId).lean();
    if (!providerOp || !providerOp.providerOperationId) {
      throw new AppError(
        404,
        "PROVIDER_OPERATION_NOT_FOUND",
        "Provider operation not found or not yet dispatched",
      );
    }

    const response = await providerClient.getOperation({
      operationId: providerOp.providerOperationId,
      idempotencyKey: `reconcile-${providerOp._id}`,
    });

    const providerResponse = response.data;
    const providerStatus = providerResponse.status;

    if (providerStatus === "SUCCEEDED") {
      return processRefund({ providerOperationId, auth });
    }
    if (providerStatus === "DECLINED") {
      return processRefund({ providerOperationId, auth });
    }
    if (
      providerStatus === "UNKNOWN_TO_CLIENT" ||
      providerStatus === "PROCESSING" ||
      providerStatus === "RECEIVED"
    ) {
      return {
        providerOperation: providerOp,
        status: "UNRESOLVED",
        message: "Provider operation still processing or unknown",
      };
    }

    throw new AppError(
      502,
      "PROVIDER_UNEXPECTED_STATUS",
      `Unexpected provider status during reconciliation: ${providerStatus}`,
    );
  }

  return {
    initiateAuthorization,
    processAuthorization,
    initiateCapture,
    processCapture,
    initiateRefund,
    processRefund,
    reconcileAuthorization,
    reconcileCapture,
    reconcileRefund,
  };
}

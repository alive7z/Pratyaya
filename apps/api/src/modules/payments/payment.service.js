
import mongoose from "mongoose";
import {
  IDEMPOTENCY_OPERATIONS,
  IDEMPOTENCY_STATE,
  OUTBOX_EVENT_TYPES,
  OUTBOX_STATE,
  PAYMENT_STATUS,
} from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { runInTransaction } from "../../lib/transaction.js";
import { Payment } from "./payment.model.js";
import { IdempotencyRecord } from "./idempotency-record.model.js";
import { OutboxEvent } from "./outbox-event.model.js";
import { PaymentEvent } from "./payment-event.model.js";
import { ProviderOperation } from "./operations/provider-operation.model.js";
import { recordPaymentEvent, toPaymentDto } from "./payment.repository.js";
import {
  assertTransition,
  CANCELLABLE_STATUSES,
} from "./payment.state-machine.js";
import {
  fingerprintPaymentCreate,
  fingerprintObject,
  getIdempotencyKey,
  hashIdempotencyKey,
  hashPayload,
} from "../../lib/idempotency.js";
import { createPaymentOrchestratorService } from "./operations/payment-orchestrator.service.js";
import { riskDecisionService } from "../risk/risk-decision.service.js";

function generateReference() {
  const suffix = new mongoose.Types.ObjectId()
    .toString()
    .slice(-10)
    .toUpperCase();
  return `PAY-${suffix}`;
}

function now() {
  return new Date();
}

let orchestrator;

async function getOrchestrator(config, logger) {
  if (!orchestrator) {
    orchestrator = await createPaymentOrchestratorService(config, logger);
  }
  return orchestrator;
}

export async function createPayment({
  auth,
  body,
  req,
  injectFailureAfterRisk = false,
}) {
  const merchantId = auth.merchantId;
  const key = getIdempotencyKey(req);
  const keyHash = hashIdempotencyKey(key);
  const fingerprint = fingerprintPaymentCreate(body);
  const fingerprintHash = hashPayload(fingerprint);
  const reference = body.merchantReference ?? generateReference();
  const customerReference = body.customerReference ?? null;
  const customerLabel = customerReference ?? body.description ?? reference;

  try {
    return await runInTransaction(async (session) => {
      const existing = await IdempotencyRecord.findOne(
        {
          merchantId,
          operation: IDEMPOTENCY_OPERATIONS.CREATE_PAYMENT,
          keyHash,
        },
        null,
        { session },
      );

      if (existing) {
        if (existing.requestFingerprint !== fingerprintHash) {
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_CONFLICT",
            "Idempotency-Key was used with a different payload",
            {
              operation: IDEMPOTENCY_OPERATIONS.CREATE_PAYMENT,
            },
          );
        }

        if (existing.status === IDEMPOTENCY_STATE.COMPLETED) {
          if (!existing.paymentId) {
            throw new AppError(
              409,
              "IDEMPOTENCY_IN_PROGRESS",
              "Idempotency record is in progress or invalid",
            );
          }

          const payment = await Payment.findById(existing.paymentId)
            .session(session)
            .lean();

          if (
            !payment ||
            String(payment.merchantId) !== String(merchantId)
          ) {
            throw new AppError(
              404,
              "PAYMENT_NOT_FOUND",
              "Payment not found",
            );
          }

          return {
            payment: toPaymentDto(payment),
            idempotent: true,
            status: 201,
          };
        }

        if (existing.status === IDEMPOTENCY_STATE.IN_PROGRESS) {
          throw new AppError(
            409,
            "IDEMPOTENCY_IN_PROGRESS",
            "A request with this Idempotency-Key is already in progress",
          );
        }

        throw new AppError(
          409,
          "IDEMPOTENCY_FAILED",
          "A previous request with this Idempotency-Key failed",
        );
      }

      const [idempotency] = await IdempotencyRecord.create(
        [
          {
            merchantId,
            operation: IDEMPOTENCY_OPERATIONS.CREATE_PAYMENT,
            keyHash,
            requestFingerprint: fingerprintHash,
            status: IDEMPOTENCY_STATE.IN_PROGRESS,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        ],
        { session },
      );

      let payment;

      try {
        [payment] = await Payment.create(
          [
            {
              merchantId,
              reference,
              customerReference,
              customerLabel,
              amountMinor: BigInt(body.amountMinor),
              capturedMinor: 0n,
              refundedMinor: 0n,
              currency: body.currency,
              status: PAYMENT_STATUS.CREATED,
              riskScore: 0,
              description: body.description,
              metadata: body.metadata,
              createdByUserId: auth.user?._id ?? auth.userId,
              isDemo: Boolean(auth.isDemo),
            },
          ],
          { session },
        );
      } catch (error) {
        if (error?.code === 11000) {
          const existingPayment = await Payment.findOne(
            { merchantId, reference },
            null,
            { session },
          ).lean();

          if (existingPayment) {
            throw new AppError(
              409,
              "MERCHANT_REFERENCE_CONFLICT",
              "A payment with this merchant reference already exists",
            );
          }
        }

        throw error;
      }

      const riskResult = await riskDecisionService.evaluateAndRecord(
        merchantId,
        payment._id,
        {
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          customerReference: payment.customerReference,
          description: payment.description,
          isDemo: payment.isDemo,
          reference: payment.reference,
        },
        "RULE_ENGINE",
        { session },
      );

      if (injectFailureAfterRisk) {
        throw new Error("Injected failure after risk decision");
      }

      if (riskResult.decision === "BLOCK") {
        await Payment.findOneAndUpdate(
          { _id: payment._id, merchantId },
          {
            $set: {
              status: PAYMENT_STATUS.FAILED,
              statusReason: "Blocked by risk engine",
            },
          },
          { session },
        );

        throw new AppError(
          403,
          "PAYMENT_BLOCKED",
          "Payment blocked by risk engine",
          {
            riskScore: riskResult.score,
            riskLevel: riskResult.level,
          },
        );
      }

      await recordPaymentEvent(
        {
          paymentId: payment._id,
          merchantId,
          eventType: "payment.created",
          fromStatus: null,
          toStatus: PAYMENT_STATUS.CREATED,
          actorUserId: auth.user?._id ?? auth.userId,
          actorRole: auth.role,
          summary: "Payment created",
          metadata: {
            amountMinor: body.amountMinor,
            currency: body.currency,
            riskScore: riskResult.score,
            riskLevel: riskResult.level,
            riskDecision: riskResult.decision,
          },
          isDemo: Boolean(auth.isDemo),
        },
        session,
      );

      await OutboxEvent.create(
        [
          {
            merchantId,
            aggregateType: "payment",
            aggregateId: payment._id,
            eventType: OUTBOX_EVENT_TYPES.PAYMENT_CREATED,
            payload: {
              paymentId: String(payment._id),
              merchantId: String(merchantId),
              amountMinor: body.amountMinor,
              currency: body.currency,
              riskScore: riskResult.score,
              riskLevel: riskResult.level,
              riskDecision: riskResult.decision,
            },
            state: OUTBOX_STATE.PENDING,
            idempotencyKeyHash: keyHash,
            isDemo: Boolean(auth.isDemo),
          },
        ],
        { session },
      );

      await IdempotencyRecord.updateOne(
        { _id: idempotency._id },
        {
          $set: {
            status: IDEMPOTENCY_STATE.COMPLETED,
            paymentId: payment._id,
            responseStatus: 201,
            completedAt: now(),
          },
        },
        { session },
      );

      return {
        payment: toPaymentDto(payment),
        idempotent: false,
        status: 201,
      };
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        409,
        "PAYMENT_CONFLICT",
        "Payment reference or idempotency key already exists",
      );
    }

    throw error;
  }
}

export async function listPayments({ auth, query }) {
  const merchantId = auth.merchantId;
  const filter = { merchantId };

  if (query.status) filter.status = query.status;

  if (query.from || query.to) {
    filter.createdAt = {};

    if (query.from) {
      filter.createdAt.$gte = new Date(query.from);
    }

    if (query.to) {
      filter.createdAt.$lte = new Date(query.to);
    }
  }

  const limit = query.limit ?? 20;

  const payments = await Payment.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return {
    payments: payments.map((payment) => toPaymentDto(payment)),
    count: payments.length,
  };
}

export async function getPayment({ auth, paymentId }) {
  const merchantId = auth.merchantId;

  const payment = await Payment.findOne({
    _id: paymentId,
    merchantId,
  }).lean();

  if (!payment) {
    throw new AppError(
      404,
      "PAYMENT_NOT_FOUND",
      "Payment not found",
    );
  }

  return toPaymentDto(payment);
}

export async function getPaymentTimeline({ auth, paymentId }) {
  const merchantId = auth.merchantId;

  const payment = await Payment.findOne({
    _id: paymentId,
    merchantId,
  }).lean();

  if (!payment) {
    throw new AppError(
      404,
      "PAYMENT_NOT_FOUND",
      "Payment not found",
    );
  }

  const events = await PaymentEvent.find({
    paymentId,
    merchantId,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  return {
    payment: toPaymentDto(payment),
    events: events.map((event) => ({
      id: String(event._id),
      eventType: event.eventType,
      fromStatus: event.fromStatus ?? null,
      toStatus: event.toStatus ?? null,
      summary: event.summary,
      actorRole: event.actorRole ?? null,
      metadata: event.metadata ?? null,
      createdAt: event.createdAt,
    })),
  };
}

export async function getPaymentAttempts({ auth, paymentId }) {
  const merchantId = auth.merchantId;

  const payment = await Payment.findOne({
    _id: paymentId,
    merchantId,
  }).lean();

  if (!payment) {
    throw new AppError(
      404,
      "PAYMENT_NOT_FOUND",
      "Payment not found",
    );
  }

  const operations = await ProviderOperation.find({
    paymentId,
    merchantId,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  return {
    payment: toPaymentDto(payment),
    attempts: operations.map((op) => ({
      id: String(op._id),
      attemptNumber: op.attemptCount + 1,
      operationType: op.type,
      providerName: "mock-provider",
      currentState: op.state,
      providerOperationId: op.providerOperationId,
      providerReference: op.providerReference,
      clientOperationId: op.clientOperationId,
      latencyMs:
        op.processingStartedAt && op.processingCompletedAt
          ? op.processingCompletedAt.getTime() -
            op.processingStartedAt.getTime()
          : null,
      retryReason: op.stateReason,
      createdAt: op.createdAt,
      completedAt: op.processingCompletedAt,
      error: op.faultInjected
        ? {
            type: op.faultInjected,
            message: op.stateReason,
          }
        : null,
    })),
  };
}

export async function getPaymentSummary({ auth }) {
  const merchantId = auth.merchantId;

  const [total, byStatus] = await Promise.all([
    Payment.countDocuments({ merchantId }),
    Payment.aggregate([
      { $match: { merchantId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const statusCounts = {};

  for (const entry of byStatus) {
    statusCounts[entry._id] = entry.count;
  }

  return { total, statusCounts };
}

export async function capturePayment({
  auth,
  paymentId,
  body = {},
  idempotencyKey,
}) {
  const payment = await Payment.findOne({
    _id: paymentId,
    merchantId: auth.merchantId,
  }).lean();

  if (!payment) {
    throw new AppError(
      404,
      "PAYMENT_NOT_FOUND",
      "Payment not found",
    );
  }

  if (payment.status !== PAYMENT_STATUS.AUTHORIZED) {
    throw new AppError(
      409,
      "INVALID_PAYMENT_STATE",
      "Only AUTHORIZED payments can be captured",
      { status: payment.status },
    );
  }

  const captureAmount =
    body.amountMinor == null
      ? BigInt(payment.amountMinor)
      : BigInt(body.amountMinor);

  if (
    captureAmount <= 0n ||
    captureAmount > BigInt(payment.amountMinor)
  ) {
    throw new AppError(
      422,
      "INVALID_CAPTURE_AMOUNT",
      "Capture amount must be greater than zero and cannot exceed the authorized amount",
    );
  }

  const orchestratorService = await getOrchestrator(
    auth.config,
    auth.logger,
  );

  const result = await orchestratorService.initiateCapture({
    auth,
    paymentId,
    amountMinor: captureAmount.toString(),
    idempotencyKey,
    mode: "manual",
  });

  return {
    payment: result.payment,
    providerOperationId: result.providerOperation?._id ?? null,
  };
}

export async function cancelPayment({ auth, paymentId, req }) {
  const merchantId = auth.merchantId;
  const key = getIdempotencyKey(req);
  const keyHash = hashIdempotencyKey(key);
  const requestFingerprint = hashPayload(
    fingerprintObject({ paymentId }),
  );

  return runInTransaction(async (session) => {
    const existingIdem = await IdempotencyRecord.findOne(
      {
        merchantId,
        operation: IDEMPOTENCY_OPERATIONS.CANCEL_PAYMENT,
        keyHash,
      },
      null,
      { session },
    );

    if (existingIdem) {
      if (existingIdem.requestFingerprint !== requestFingerprint) {
        throw new AppError(
          409,
          "IDEMPOTENCY_KEY_CONFLICT",
          "Idempotency-Key was used with a different cancellation request",
        );
      }

      if (existingIdem.status === IDEMPOTENCY_STATE.IN_PROGRESS) {
        throw new AppError(
          409,
          "IDEMPOTENCY_IN_PROGRESS",
          "A request with this Idempotency-Key is already in progress",
        );
      }

      if (
        existingIdem.status === IDEMPOTENCY_STATE.COMPLETED &&
        existingIdem.paymentId
      ) {
        const payment = await Payment.findById(
          existingIdem.paymentId,
        )
          .session(session)
          .lean();

        if (
          payment &&
          String(payment.merchantId) === String(merchantId)
        ) {
          return {
            payment: toPaymentDto(payment),
            idempotent: true,
          };
        }
      }

      throw new AppError(
        409,
        "IDEMPOTENCY_UNAVAILABLE",
        "This idempotency key cannot be reused for cancellation",
      );
    }

    const [idempotency] = await IdempotencyRecord.create(
      [
        {
          merchantId,
          operation: IDEMPOTENCY_OPERATIONS.CANCEL_PAYMENT,
          keyHash,
          requestFingerprint,
          status: IDEMPOTENCY_STATE.IN_PROGRESS,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      ],
      { session },
    );

    const payment = await Payment.findOne({
      _id: paymentId,
      merchantId,
    }).session(session);

    if (!payment) {
      throw new AppError(
        404,
        "PAYMENT_NOT_FOUND",
        "Payment not found",
      );
    }

    if (!CANCELLABLE_STATUSES.includes(payment.status)) {
      throw new AppError(
        409,
        "PAYMENT_NOT_CANCELLABLE",
        "Only CREATED or QUEUED payments can be cancelled",
        { status: payment.status },
      );
    }

    const fromStatus = payment.status;

    assertTransition(
      fromStatus,
      PAYMENT_STATUS.CANCELLED,
    );

    const cancelled = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        merchantId,
        status: fromStatus,
        version: payment.version ?? 0,
      },
      {
        $set: {
          status: PAYMENT_STATUS.CANCELLED,
          cancelledAt: new Date(),
        },
        $inc: { version: 1 },
      },
      {
        returnDocument: "after",
        session,
      },
    );

    if (!cancelled) {
      throw new AppError(
        409,
        "PAYMENT_CONCURRENCY_CONFLICT",
        "Payment changed while cancellation was being applied",
      );
    }

    await recordPaymentEvent(
      {
        paymentId: payment._id,
        merchantId,
        eventType: "payment.cancelled",
        fromStatus,
        toStatus: PAYMENT_STATUS.CANCELLED,
        actorUserId: auth.user?._id ?? auth.userId,
        actorRole: auth.role,
        summary: "Payment cancelled",
        metadata: null,
        isDemo: Boolean(auth.isDemo),
      },
      session,
    );

    await OutboxEvent.create(
      [
        {
          merchantId,
          aggregateType: "payment",
          aggregateId: cancelled._id,
          eventType: OUTBOX_EVENT_TYPES.PAYMENT_CANCELLED,
          payload: {
            paymentId: String(cancelled._id),
            merchantId: String(merchantId),
          },
          state: OUTBOX_STATE.PENDING,
          idempotencyKeyHash: keyHash,
          isDemo: Boolean(auth.isDemo),
        },
      ],
      { session },
    );

    await IdempotencyRecord.updateOne(
      { _id: idempotency._id },
      {
        $set: {
          status: IDEMPOTENCY_STATE.COMPLETED,
          paymentId: cancelled._id,
          responseStatus: 200,
          completedAt: now(),
        },
      },
      { session },
    );

    return {
      payment: toPaymentDto(cancelled),
      idempotent: false,
    };
  });
}

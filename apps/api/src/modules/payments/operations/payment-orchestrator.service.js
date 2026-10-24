
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

const {
  PENDING,
  IN_FLIGHT,
  SUCCEEDED,
  FAILED,
  UNKNOWN,
} = OPERATION_STATES;

const { AUTHORIZE, CAPTURE, REFUND } = OPERATION_TYPES;

const now = () => new Date();

function generateClientOperationId(prefix) {
  return `${prefix}-${new mongoose.Types.ObjectId().toString().slice(-16)}`;
}

function amount(value) {
  return BigInt(value ?? 0);
}

function paymentFilter(paymentId, merchantId) {
  return { _id: paymentId, merchantId };
}

function operationFilter(operationId, merchantId) {
  return { _id: operationId, merchantId };
}

function ensurePositiveAmount(value, maximum) {
  let requested;

  try {
    requested = BigInt(value);
  } catch {
    throw new AppError(
      422,
      "INVALID_AMOUNT",
      "Amount must be a positive integer",
    );
  }

  if (requested <= 0n || requested > maximum) {
    throw new AppError(
      422,
      "INVALID_AMOUNT",
      "Amount must be positive and within the available limit",
    );
  }

  return requested;
}

async function addEvent(session, auth, payment, options) {
  await recordPaymentEvent(
    {
      paymentId: payment._id,
      merchantId: auth.merchantId,
      actorRole: options.actorRole ?? auth.role ?? "system",
      actorUserId: options.actorUserId ?? auth.user?._id ?? auth.userId,
      isDemo: Boolean(auth.isDemo),
      eventType: options.eventType,
      fromStatus: options.fromStatus,
      toStatus: options.toStatus,
      summary: options.summary,
      metadata: options.metadata ?? null,
    },
    session,
  );
}

async function enqueueEvent(
  session,
  auth,
  payment,
  eventType,
  payload,
) {
  await OutboxEvent.create(
    [
      {
        merchantId: auth.merchantId,
        aggregateType: "payment",
        aggregateId: payment._id,
        eventType,
        payload: {
          paymentId: String(payment._id),
          merchantId: String(auth.merchantId),
          ...payload,
        },
        state: OUTBOX_STATE.PENDING,
        availableAt: now(),
        isDemo: Boolean(auth.isDemo),
      },
    ],
    { session },
  );
}

async function updatePaymentStatus(
  session,
  payment,
  merchantId,
  nextStatus,
  extra = {},
) {
  const updated = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      merchantId,
      status: payment.status,
      version: payment.version,
    },
    {
      $set: {
        status: nextStatus,
        ...extra,
      },
      $inc: { version: 1 },
    },
    {
      session,
      returnDocument: "after",
    },
  );

  if (!updated) {
    throw new AppError(
      409,
      "PAYMENT_CONCURRENCY_CONFLICT",
      "Payment state changed while processing the operation",
    );
  }

  return updated;
}

async function loadPayment(session, auth, paymentId) {
  const payment = await Payment.findOne(
    paymentFilter(paymentId, auth.merchantId),
  ).session(session);

  if (!payment) {
    throw new AppError(
      404,
      "PAYMENT_NOT_FOUND",
      "Payment not found",
    );
  }

  return payment;
}

async function createProviderOperation(
  session,
  auth,
  payment,
  {
    type,
    clientOperationId,
    amountMinor,
    idempotencyKey,
    requestPayload,
  },
) {
  const [operation] = await ProviderOperation.create(
    [
      {
        paymentId: payment._id,
        merchantId: auth.merchantId,
        type,
        providerOperationId: clientOperationId,
        clientOperationId,
        amountMinor,
        currency: payment.currency,
        state: PENDING,
        requestPayload,
        idempotencyKey,
        attemptCount: 0,
        isDemo: Boolean(auth.isDemo),
      },
    ],
    { session },
  );

  return operation;
}

async function getOperation(operationId, merchantId) {
  const operation = await ProviderOperation.findOne(
    operationFilter(operationId, merchantId),
  ).lean();

  if (!operation) {
    throw new AppError(
      404,
      "PROVIDER_OPERATION_NOT_FOUND",
      "Provider operation not found",
    );
  }

  return operation;
}

async function claimOperation(operationId, merchantId) {
  const claimed = await ProviderOperation.findOneAndUpdate(
    {
      ...operationFilter(operationId, merchantId),
      state: PENDING,
    },
    {
      $set: {
        state: IN_FLIGHT,
        lastAttemptAt: now(),
      },
      $inc: { attemptCount: 1 },
    },
    { returnDocument: "after" },
  ).lean();

  if (claimed) return claimed;

  const existing = await getOperation(operationId, merchantId);

  return {
    ...existing,
    alreadyProcessed: true,
  };
}

async function markUnknown(operation, auth, reason) {
  return runFinancialTransaction(async (session) => {
    const current = await ProviderOperation.findOne(
      operationFilter(operation._id, auth.merchantId),
    ).session(session);

    if (!current) {
      throw new AppError(
        404,
        "PROVIDER_OPERATION_NOT_FOUND",
        "Provider operation not found",
      );
    }

    if (![PENDING, IN_FLIGHT].includes(current.state)) {
      return {
        providerOperation: current.toObject(),
        alreadyProcessed: true,
      };
    }

    const updatedOperation = await ProviderOperation.findOneAndUpdate(
      {
        _id: current._id,
        merchantId: auth.merchantId,
        state: current.state,
      },
      {
        $set: {
          state: UNKNOWN,
          stateReason: reason,
          processingCompletedAt: now(),
        },
      },
      { session, returnDocument: "after" },
    );

    if (!updatedOperation) {
      throw new AppError(
        409,
        "OPERATION_CONCURRENCY_CONFLICT",
        "Provider operation changed while processing",
      );
    }

    const payment = await loadPayment(
      session,
      auth,
      current.paymentId,
    );

    if ([AUTHORIZE, CAPTURE].includes(current.type)) {
      const expectedStatus =
        current.type === AUTHORIZE
          ? PAYMENT_STATUS.AUTHORIZING
          : PAYMENT_STATUS.CAPTURING;

      if (payment.status === expectedStatus) {
        const updatedPayment = await updatePaymentStatus(
          session,
          payment,
          auth.merchantId,
          PAYMENT_STATUS.UNKNOWN,
          { statusReason: reason },
        );

        await addEvent(session, auth, payment, {
          eventType: "payment.unknown",
          fromStatus: payment.status,
          toStatus: PAYMENT_STATUS.UNKNOWN,
          actorRole: "provider",
          summary: reason,
          metadata: {
            providerOperationId: String(current._id),
            operationType: current.type,
          },
        });

        await enqueueEvent(
          session,
          auth,
          payment,
          OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED,
          {
            providerOperationId: String(current._id),
            reason: `${current.type.toLowerCase()}_unknown`,
          },
        );

        return {
          providerOperation: updatedOperation.toObject(),
          payment: toPaymentDto(updatedPayment),
        };
      }
    }

    await addEvent(session, auth, payment, {
      eventType: "payment.refund.unknown",
      fromStatus: payment.status,
      toStatus: payment.status,
      actorRole: "provider",
      summary: reason,
      metadata: {
        providerOperationId: String(current._id),
      },
    });

    await enqueueEvent(
      session,
      auth,
      payment,
      OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED,
      {
        providerOperationId: String(current._id),
        reason: "refund_unknown",
      },
    );

    return {
      providerOperation: updatedOperation.toObject(),
      payment: toPaymentDto(payment),
    };
  });
}

export async function createPaymentOrchestratorService(config, logger) {
  const providerClient = createProviderClientService(config, logger);

  async function initiateAuthorization({
    auth,
    paymentId,
    idempotencyKey,
  }) {
    return runFinancialTransaction(async (session) => {
      const payment = await loadPayment(session, auth, paymentId);

      const existing = await ProviderOperation.findOne({
        paymentId,
        merchantId: auth.merchantId,
        type: AUTHORIZE,
        state: { $in: [PENDING, IN_FLIGHT, UNKNOWN] },
      })
        .session(session)
        .lean();

      if (existing) {
        return {
          providerOperation: existing,
          payment: toPaymentDto(payment),
          alreadyInProgress: true,
        };
      }

      if (payment.status !== PAYMENT_STATUS.QUEUED) {
        throw new AppError(
          409,
          "INVALID_PAYMENT_STATE",
          "Only QUEUED payments can be authorized",
        );
      }

      const clientOperationId = generateClientOperationId("auth");

      const providerOperation = await createProviderOperation(
        session,
        auth,
        payment,
        {
          type: AUTHORIZE,
          clientOperationId,
          amountMinor: payment.amountMinor,
          idempotencyKey: `${idempotencyKey}-auth`,
          requestPayload: {
            clientOperationId,
            amountMinor: payment.amountMinor.toString(),
            currency: payment.currency,
            paymentMethod: {
              type: "card",
              token: "tok_demo_123",
            },
            description: payment.description,
            metadata: payment.metadata,
          },
        },
      );

      const updated = await updatePaymentStatus(
        session,
        payment,
        auth.merchantId,
        PAYMENT_STATUS.AUTHORIZING,
      );

      await addEvent(session, auth, payment, {
        eventType: "payment.authorizing",
        fromStatus: payment.status,
        toStatus: PAYMENT_STATUS.AUTHORIZING,
        summary: "Authorization requested",
        metadata: {
          providerOperationId: String(providerOperation._id),
        },
      });

      await enqueueEvent(
        session,
        auth,
        payment,
        OUTBOX_EVENT_TYPES.PAYMENT_AUTHORIZE_REQUESTED,
        {
          providerOperationId: String(providerOperation._id),
          clientOperationId,
        },
      );

      return {
        providerOperation,
        payment: toPaymentDto(updated),
        alreadyInProgress: false,
      };
    });
  }

  async function initiateCapture({
    auth,
    paymentId,
    idempotencyKey,
    amountMinor,
    mode = "automatic",
  }) {
    return runFinancialTransaction(async (session) => {
      const payment = await loadPayment(session, auth, paymentId);

      const existing = await ProviderOperation.findOne({
        paymentId,
        merchantId: auth.merchantId,
        type: CAPTURE,
        state: { $in: [PENDING, IN_FLIGHT, UNKNOWN] },
      })
        .session(session)
        .lean();

      if (existing) {
        return {
          providerOperation: existing,
          payment: toPaymentDto(payment),
          alreadyInProgress: true,
        };
      }

      if (payment.status !== PAYMENT_STATUS.AUTHORIZED) {
        throw new AppError(
          409,
          "INVALID_PAYMENT_STATE",
          "Only AUTHORIZED payments can be captured",
        );
      }

      const captureAmount = ensurePositiveAmount(
        amountMinor ?? payment.amountMinor,
        amount(payment.amountMinor),
      );

      const authorization = await ProviderOperation.findOne({
        paymentId,
        merchantId: auth.merchantId,
        type: AUTHORIZE,
        state: SUCCEEDED,
      })
        .session(session)
        .lean();

      if (!authorization?.providerOperationId) {
        throw new AppError(
          409,
          "AUTHORIZATION_NOT_CONFIRMED",
          "A confirmed authorization is required",
        );
      }

      const clientOperationId = generateClientOperationId("cap");

      const providerOperation = await createProviderOperation(
        session,
        auth,
        payment,
        {
          type: CAPTURE,
          clientOperationId,
          amountMinor: captureAmount,
          idempotencyKey: `${idempotencyKey}-capture`,
          requestPayload: {
            clientOperationId,
            authorizationOperationId:
              authorization.providerOperationId,
            amountMinor: captureAmount.toString(),
            currency: payment.currency,
            metadata: payment.metadata,
          },
        },
      );

      const updated = await updatePaymentStatus(
        session,
        payment,
        auth.merchantId,
        PAYMENT_STATUS.CAPTURING,
      );

      await addEvent(session, auth, payment, {
        eventType: "payment.capturing",
        fromStatus: payment.status,
        toStatus: PAYMENT_STATUS.CAPTURING,
        summary: `Capture requested (${mode})`,
        metadata: {
          providerOperationId: String(providerOperation._id),
          amountMinor: captureAmount.toString(),
        },
      });

      await enqueueEvent(
        session,
        auth,
        payment,
        OUTBOX_EVENT_TYPES.PAYMENT_CAPTURE_REQUESTED,
        {
          providerOperationId: String(providerOperation._id),
          clientOperationId,
          amountMinor: captureAmount.toString(),
          mode,
        },
      );

      return {
        providerOperation,
        payment: toPaymentDto(updated),
        alreadyInProgress: false,
      };
    });
  }

  async function initiateRefund({
    auth,
    paymentId,
    amountMinor,
    reason,
    idempotencyKey,
  }) {
    return runFinancialTransaction(async (session) => {
      const payment = await loadPayment(session, auth, paymentId);

      const allowed = [
        PAYMENT_STATUS.CAPTURED,
        PAYMENT_STATUS.REFUND_PENDING,
        PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ];

      const existing = await ProviderOperation.findOne({
        paymentId,
        merchantId: auth.merchantId,
        type: REFUND,
        idempotencyKey: `${idempotencyKey}-refund`,
      })
        .session(session)
        .lean();

      if (existing) {
        if (
          amount(existing.amountMinor) !== amount(amountMinor) ||
          (existing.requestPayload?.reason ?? null) !== (reason ?? null)
        ) {
          throw new AppError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Refund idempotency key was used with a different request",
          );
        }

        return {
          providerOperation: existing,
          payment: toPaymentDto(payment),
          alreadyInProgress: true,
        };
      }

      if (!allowed.includes(payment.status)) {
        throw new AppError(
          409,
          "INVALID_PAYMENT_STATE",
          "Only captured payments can be refunded",
        );
      }

      const captured = amount(payment.capturedMinor);
      const refunded = amount(payment.refundedMinor);

      const pendingOperations = await ProviderOperation.find({
        paymentId,
        merchantId: auth.merchantId,
        type: REFUND,
        state: { $in: [PENDING, IN_FLIGHT, UNKNOWN] },
      })
        .session(session)
        .select("amountMinor")
        .lean();

      const reserved = pendingOperations.reduce(
        (total, operation) => total + amount(operation.amountMinor),
        0n,
      );

      const refundable = captured - refunded - reserved;

      if (refundable <= 0n) {
        throw new AppError(
          409,
          "NO_REFUNDABLE_BALANCE",
          "No captured funds are available for refund",
        );
      }

      const refundAmount = ensurePositiveAmount(
        amountMinor,
        refundable,
      );

      const captureOperation = await ProviderOperation.findOne({
        paymentId,
        merchantId: auth.merchantId,
        type: CAPTURE,
        state: SUCCEEDED,
      })
        .session(session)
        .lean();

      if (!captureOperation?.providerOperationId) {
        throw new AppError(
          409,
          "CAPTURE_NOT_CONFIRMED",
          "A confirmed capture is required for refund",
        );
      }

      const clientOperationId = generateClientOperationId("ref");

      const providerOperation = await createProviderOperation(
        session,
        auth,
        payment,
        {
          type: REFUND,
          clientOperationId,
          amountMinor: refundAmount,
          idempotencyKey: `${idempotencyKey}-refund`,
          requestPayload: {
            clientOperationId,
            captureOperationId:
              captureOperation.providerOperationId,
            amountMinor: refundAmount.toString(),
            currency: payment.currency,
            reason,
            metadata: payment.metadata,
          },
        },
      );

      const updated = await updatePaymentStatus(
        session,
        payment,
        auth.merchantId,
        PAYMENT_STATUS.REFUND_PENDING,
      );

      await addEvent(session, auth, payment, {
        eventType: "payment.refund.requested",
        fromStatus: payment.status,
        toStatus: PAYMENT_STATUS.REFUND_PENDING,
        summary: "Refund requested",
        metadata: {
          providerOperationId: String(providerOperation._id),
          amountMinor: refundAmount.toString(),
          reason,
        },
      });

      await enqueueEvent(
        session,
        auth,
        payment,
        OUTBOX_EVENT_TYPES.PAYMENT_REFUND_REQUESTED,
        {
          providerOperationId: String(providerOperation._id),
          clientOperationId,
          amountMinor: refundAmount.toString(),
          reason,
        },
      );

      return {
        providerOperation,
        payment: toPaymentDto(updated),
        alreadyInProgress: false,
      };
    });
  }

  async function completeAuthorization({
    providerOperationId,
    auth,
    providerResponse,
  }) {
    return runFinancialTransaction(async (session) => {
      const operation = await ProviderOperation.findOne(
        operationFilter(providerOperationId, auth.merchantId),
      ).session(session);

      if (!operation) {
        throw new AppError(
          404,
          "PROVIDER_OPERATION_NOT_FOUND",
          "Provider operation not found",
        );
      }

      if ([SUCCEEDED, FAILED].includes(operation.state)) {
        return {
          providerOperation: operation,
          alreadyProcessed: true,
        };
      }

      const payment = await loadPayment(
        session,
        auth,
        operation.paymentId,
      );

      const succeeded = providerResponse.status === "SUCCEEDED";
      const declined = providerResponse.status === "DECLINED";

      if (!succeeded && !declined) {
        throw new AppError(
          502,
          "PROVIDER_UNEXPECTED_STATUS",
          "Unexpected authorization status",
        );
      }

      const nextStatus = succeeded
        ? PAYMENT_STATUS.AUTHORIZED
        : PAYMENT_STATUS.FAILED;

      if (
        ![
          PAYMENT_STATUS.AUTHORIZING,
          PAYMENT_STATUS.UNKNOWN,
        ].includes(payment.status)
      ) {
        throw new AppError(
          409,
          "INVALID_PAYMENT_STATE",
          "Payment cannot accept authorization outcome",
        );
      }

      const updated = await updatePaymentStatus(
        session,
        payment,
        auth.merchantId,
        nextStatus,
        {
          statusReason: declined
            ? providerResponse.statusReason ??
              "Authorization declined"
            : null,
        },
      );

      const updatedOperation = await ProviderOperation.findOneAndUpdate(
        {
          _id: operation._id,
          merchantId: auth.merchantId,
          state: { $in: [PENDING, IN_FLIGHT, UNKNOWN] },
        },
        {
          $set: {
            state: succeeded ? SUCCEEDED : FAILED,
            stateReason: providerResponse.statusReason ?? null,
            providerOperationId:
              providerResponse.operationId ??
              operation.providerOperationId,
            providerReference:
              providerResponse.providerReference ?? null,
            responsePayload: providerResponse,
            processingCompletedAt: now(),
          },
        },
        { session, returnDocument: "after" },
      );

      if (!updatedOperation) {
        throw new AppError(
          409,
          "OPERATION_CONCURRENCY_CONFLICT",
          "Authorization outcome was already changed",
        );
      }

      await addEvent(session, auth, payment, {
        eventType: succeeded
          ? "payment.authorized"
          : "payment.failed",
        fromStatus: payment.status,
        toStatus: nextStatus,
        actorRole: "provider",
        summary: succeeded
          ? "Authorization succeeded"
          : "Authorization declined",
        metadata: {
          providerOperationId: providerResponse.operationId,
        },
      });

      if (succeeded) {
        await enqueueEvent(
          session,
          auth,
          payment,
          OUTBOX_EVENT_TYPES.PAYMENT_CAPTURE_REQUESTED,
          {
            amountMinor: payment.amountMinor.toString(),
            currency: payment.currency,
            mode: "automatic",
          },
        );
      }

      return {
        providerOperation: updatedOperation,
        payment: toPaymentDto(updated),
      };
    });
  }

  async function completeCapture({
    providerOperationId,
    auth,
    providerResponse,
  }) {
    const operation = await getOperation(
      providerOperationId,
      auth.merchantId,
    );

    if (operation.state === SUCCEEDED) {
      return {
        providerOperation: operation,
        alreadyProcessed: true,
      };
    }

    if (providerResponse.status === "SUCCEEDED") {
      const { confirmTrustedCapture } = await import(
        "../../ledger/payment-ledger.service.js"
      );

      const result = await confirmTrustedCapture({
        merchantId: auth.merchantId,
        paymentId: operation.paymentId,
        providerEventId:
          providerResponse.operationId ??
          operation.providerOperationId,
        amountMinor: operation.amountMinor.toString(),
        actor: "provider",
        requestId: operation.idempotencyKey,
        isDemo: Boolean(auth.isDemo),
      });

      const updated = await ProviderOperation.findOneAndUpdate(
        {
          _id: operation._id,
          merchantId: auth.merchantId,
          state: { $in: [PENDING, IN_FLIGHT, UNKNOWN] },
        },
        {
          $set: {
            state: SUCCEEDED,
            providerOperationId:
              providerResponse.operationId ??
              operation.providerOperationId,
            providerReference:
              providerResponse.providerReference ?? null,
            responsePayload: providerResponse,
            processingCompletedAt: now(),
          },
        },
        { returnDocument: "after" },
      );

      return {
        providerOperation: updated ?? operation,
        payment: result.payment,
        journal: result.journal,
      };
    }

    if (providerResponse.status !== "DECLINED") {
      throw new AppError(
        502,
        "PROVIDER_UNEXPECTED_STATUS",
        "Unexpected capture status",
      );
    }

    return runFinancialTransaction(async (session) => {
      const current = await ProviderOperation.findOne(
        operationFilter(providerOperationId, auth.merchantId),
      ).session(session);

      if ([SUCCEEDED, FAILED].includes(current.state)) {
        return {
          providerOperation: current,
          alreadyProcessed: true,
        };
      }

      const payment = await loadPayment(
        session,
        auth,
        current.paymentId,
      );

      const updated = await updatePaymentStatus(
        session,
        payment,
        auth.merchantId,
        PAYMENT_STATUS.FAILED,
        {
          statusReason:
            providerResponse.statusReason ?? "Capture declined",
        },
      );

      current.state = FAILED;
      current.stateReason = providerResponse.statusReason;
      current.responsePayload = providerResponse;
      current.processingCompletedAt = now();
      await current.save({ session });

      await addEvent(session, auth, payment, {
        eventType: "payment.capture.failed",
        fromStatus: payment.status,
        toStatus: PAYMENT_STATUS.FAILED,
        actorRole: "provider",
        summary: "Capture declined",
      });

      return {
        providerOperation: current,
        payment: toPaymentDto(updated),
      };
    });
  }

  async function completeRefund({
    providerOperationId,
    auth,
    providerResponse,
  }) {
    const operation = await getOperation(
      providerOperationId,
      auth.merchantId,
    );

    if (operation.state === SUCCEEDED) {
      return {
        providerOperation: operation,
        alreadyProcessed: true,
      };
    }

    if (providerResponse.status === "SUCCEEDED") {
      const { confirmTrustedRefund } = await import(
        "../../ledger/payment-ledger.service.js"
      );

      const result = await confirmTrustedRefund({
        merchantId: auth.merchantId,
        paymentId: operation.paymentId,
        providerEventId:
          providerResponse.operationId ??
          operation.providerOperationId,
        amountMinor: operation.amountMinor.toString(),
        actor: "provider",
        requestId: operation.idempotencyKey,
        isDemo: Boolean(auth.isDemo),
      });

      const updated = await ProviderOperation.findOneAndUpdate(
        {
          _id: operation._id,
          merchantId: auth.merchantId,
          state: { $in: [PENDING, IN_FLIGHT, UNKNOWN] },
        },
        {
          $set: {
            state: SUCCEEDED,
            providerOperationId:
              providerResponse.operationId ??
              operation.providerOperationId,
            providerReference:
              providerResponse.providerReference ?? null,
            responsePayload: providerResponse,
            processingCompletedAt: now(),
          },
        },
        { returnDocument: "after" },
      );

      return {
        providerOperation: updated ?? operation,
        payment: result.payment,
        journal: result.journal,
      };
    }

    if (providerResponse.status !== "DECLINED") {
      throw new AppError(
        502,
        "PROVIDER_UNEXPECTED_STATUS",
        "Unexpected refund status",
      );
    }

    return runFinancialTransaction(async (session) => {
      const current = await ProviderOperation.findOne(
        operationFilter(providerOperationId, auth.merchantId),
      ).session(session);

      if ([SUCCEEDED, FAILED].includes(current.state)) {
        return {
          providerOperation: current,
          alreadyProcessed: true,
        };
      }

      const payment = await loadPayment(
        session,
        auth,
        current.paymentId,
      );

      current.state = FAILED;
      current.stateReason = providerResponse.statusReason;
      current.responsePayload = providerResponse;
      current.processingCompletedAt = now();
      await current.save({ session });

      const remainingPending = await ProviderOperation.countDocuments({
        paymentId: payment._id,
        merchantId: auth.merchantId,
        type: REFUND,
        state: { $in: [PENDING, IN_FLIGHT, UNKNOWN] },
      }).session(session);

      const captured = amount(payment.capturedMinor);
      const refunded = amount(payment.refundedMinor);

      const nextStatus = remainingPending
        ? PAYMENT_STATUS.REFUND_PENDING
        : refunded === 0n
          ? PAYMENT_STATUS.CAPTURED
          : refunded >= captured
            ? PAYMENT_STATUS.REFUNDED
            : PAYMENT_STATUS.PARTIALLY_REFUNDED;

      const updated = await updatePaymentStatus(
        session,
        payment,
        auth.merchantId,
        nextStatus,
      );

      await addEvent(session, auth, payment, {
        eventType: "payment.refund.failed",
        fromStatus: payment.status,
        toStatus: nextStatus,
        actorRole: "provider",
        summary: "Refund declined",
      });

      return {
        providerOperation: current,
        payment: toPaymentDto(updated),
      };
    });
  }

  async function dispatch({
    providerOperationId,
    auth,
    type,
  }) {
    const operation = await claimOperation(
      providerOperationId,
      auth.merchantId,
    );

    if (operation.alreadyProcessed) {
      return {
        providerOperation: operation,
        alreadyProcessed: true,
      };
    }

    if (operation.type !== type) {
      throw new AppError(
        409,
        "OPERATION_TYPE_MISMATCH",
        "Provider operation type does not match dispatch request",
      );
    }

    const payload = {
      clientOperationId: operation.clientOperationId,
      amountMinor: operation.amountMinor.toString(),
      currency: operation.currency,
      idempotencyKey: operation.idempotencyKey,
      merchantId: String(auth.merchantId),
      ...operation.requestPayload,
    };

    let response;

    try {
      if (type === AUTHORIZE) {
        response = await providerClient.authorize(payload);
      } else if (type === CAPTURE) {
        response = await providerClient.capture(payload);
      } else {
        response = await providerClient.refund(payload);
      }
    } catch (error) {
      if (
        error?.code === "PROVIDER_TIMEOUT" ||
        error?.name === "AbortError" ||
        error?.name === "TimeoutError"
      ) {
        return markUnknown(
          operation,
          auth,
          "Provider request timed out; reconciliation required",
        );
      }

      throw error;
    }

    const providerResponse = response?.data ?? response;

    if (!providerResponse?.status) {
      return markUnknown(
        operation,
        auth,
        "Provider returned an invalid response; reconciliation required",
      );
    }

    if (
      providerResponse.status === "UNKNOWN_TO_CLIENT" ||
      response?.timeout
    ) {
      return markUnknown(
        operation,
        auth,
        "Provider outcome is unknown; reconciliation required",
      );
    }

    if (type === AUTHORIZE) {
      return completeAuthorization({
        providerOperationId,
        auth,
        providerResponse,
      });
    }

    if (type === CAPTURE) {
      return completeCapture({
        providerOperationId,
        auth,
        providerResponse,
      });
    }

    return completeRefund({
      providerOperationId,
      auth,
      providerResponse,
    });
  }

  function processAuthorization({ providerOperationId, auth }) {
    return dispatch({
      providerOperationId,
      auth,
      type: AUTHORIZE,
    });
  }

  function processCapture({ providerOperationId, auth }) {
    return dispatch({
      providerOperationId,
      auth,
      type: CAPTURE,
    });
  }

  function processRefund({ providerOperationId, auth }) {
    return dispatch({
      providerOperationId,
      auth,
      type: REFUND,
    });
  }

  async function reconcileOperation({
    providerOperationId,
    auth,
    type,
  }) {
    const operation = await getOperation(
      providerOperationId,
      auth.merchantId,
    );

    if (operation.type !== type) {
      throw new AppError(
        409,
        "OPERATION_TYPE_MISMATCH",
        "Provider operation type does not match reconciliation request",
      );
    }

    if ([SUCCEEDED, FAILED].includes(operation.state)) {
      return {
        providerOperation: operation,
        alreadyProcessed: true,
      };
    }

    const response = await providerClient.getOperation({
      operationId:
        operation.providerOperationId ?? operation.clientOperationId,
      idempotencyKey: `reconcile-${operation._id}`,
    });

    const providerResponse = response?.data ?? response;

    if (
      [
        "RECEIVED",
        "PROCESSING",
        "UNKNOWN_TO_CLIENT",
      ].includes(providerResponse?.status)
    ) {
      return {
        providerOperation: operation,
        status: "UNRESOLVED",
        message: "Provider operation is still unresolved",
      };
    }

    if (
      !["SUCCEEDED", "DECLINED"].includes(providerResponse?.status)
    ) {
      throw new AppError(
        502,
        "PROVIDER_UNEXPECTED_STATUS",
        "Unexpected provider reconciliation status",
      );
    }

    if (type === AUTHORIZE) {
      return completeAuthorization({
        providerOperationId,
        auth,
        providerResponse,
      });
    }

    if (type === CAPTURE) {
      return completeCapture({
        providerOperationId,
        auth,
        providerResponse,
      });
    }

    return completeRefund({
      providerOperationId,
      auth,
      providerResponse,
    });
  }

  function reconcileAuthorization({ providerOperationId, auth }) {
    return reconcileOperation({
      providerOperationId,
      auth,
      type: AUTHORIZE,
    });
  }

  function reconcileCapture({ providerOperationId, auth }) {
    return reconcileOperation({
      providerOperationId,
      auth,
      type: CAPTURE,
    });
  }

  function reconcileRefund({ providerOperationId, auth }) {
    return reconcileOperation({
      providerOperationId,
      auth,
      type: REFUND,
    });
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

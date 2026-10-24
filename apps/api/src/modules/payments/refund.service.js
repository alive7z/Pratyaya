import {
  REFUND_STATUS,
  PAYMENT_STATUS,
  OUTBOX_EVENT_TYPES,
  OUTBOX_STATE,
} from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import {
  runInTransaction,
  runFinancialTransaction,
} from "../../lib/transaction.js";
import { Payment } from "./payment.model.js";
import { Refund } from "./refund.model.js";
import { OutboxEvent } from "./outbox-event.model.js";
import { recordPaymentEvent } from "./payment.repository.js";
import { createPaymentOrchestratorService } from "./operations/payment-orchestrator.service.js";
import {
  getIdempotencyKey,
  hashIdempotencyKey,
  hashPayload,
} from "../../lib/idempotency.js";

function now() {
  return new Date();
}

export async function createRefundService(config, logger) {
  const orchestrator = await createPaymentOrchestratorService(config, logger);

  async function requestRefund({ auth, paymentId, body, req }) {
    const merchantId = auth.merchantId;
    const key = getIdempotencyKey(req);
    const keyHash = hashIdempotencyKey(key);
    const fingerprint = hashPayload({
      paymentId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      reason: body.reason,
    });

    return runInTransaction(async (session) => {
      const existing = await Refund.findOne(
        { merchantId, idempotencyKey: keyHash },
        null,
        { session },
      ).lean();

      if (existing) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_CONFLICT",
            "Idempotency-Key was used with a different refund request",
          );
        }
        if (
          existing.status === REFUND_STATUS.REQUESTED ||
          existing.status === REFUND_STATUS.QUEUED ||
          existing.status === REFUND_STATUS.PROCESSING
        ) {
          throw new AppError(
            409,
            "IDEMPOTENCY_IN_PROGRESS",
            "A refund request with this Idempotency-Key is already in progress",
          );
        }
        return { refund: toRefundDto(existing), idempotent: true };
      }

      const payment = await Payment.findOne({
        _id: paymentId,
        merchantId,
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
      const refundAmount = BigInt(body.amountMinor);

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

      const [refund] = await Refund.create(
        [
          {
            paymentId,
            merchantId,
            amountMinor: refundAmount,
            currency: payment.currency,
            reason: body.reason,
            status: REFUND_STATUS.REQUESTED,
            idempotencyKey: keyHash,
            requestFingerprint: fingerprint,
            reservedMinor: refundAmount,
            createdBy: auth.user?._id ?? auth.userId,
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

      await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          merchantId,
          version: payment.version,
          refundedMinor: payment.refundedMinor,
          status: { $in: allowedStatuses },
        },
        {
          $set: { status: nextStatus, refundedMinor: newRefunded },
          $inc: { version: 1 },
        },
        { session },
      );

      await recordPaymentEvent(
        {
          paymentId: payment._id,
          merchantId,
          eventType: "payment.refund.requested",
          fromStatus: payment.status,
          toStatus: nextStatus,
          actorUserId: auth.user?._id ?? auth.userId,
          actorRole: auth.role,
          summary: `Refund requested: ${refundAmount.toString()} ${payment.currency}`,
          metadata: {
            amountMinor: refundAmount.toString(),
            reason: body.reason,
          },
          isDemo: auth.isDemo,
        },
        session,
      );

      await OutboxEvent.create(
        [
          {
            merchantId,
            aggregateType: "payment",
            aggregateId: payment._id,
            eventType: OUTBOX_EVENT_TYPES.PAYMENT_REFUND_REQUESTED,
            payload: {
              paymentId: String(payment._id),
              merchantId: String(merchantId),
              refundId: String(refund._id),
              amountMinor: refundAmount.toString(),
              reason: body.reason,
            },
            state: OUTBOX_STATE.PENDING,
            availableAt: now(),
            idempotencyKeyHash: keyHash,
            isDemo: auth.isDemo,
          },
        ],
        { session },
      );

      return { refund: toRefundDto(refund), idempotent: false };
    });
  }

  async function getRefund({ auth, refundId }) {
    const refund = await Refund.findOne({
      _id: refundId,
      merchantId: auth.merchantId,
    }).lean();
    if (!refund) {
      throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
    }
    return toRefundDto(refund);
  }

  async function listRefunds({ auth, paymentId, query }) {
    const merchantId = auth.merchantId;
    const filter = { merchantId };
    if (paymentId) filter.paymentId = paymentId;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) filter.createdAt.$lte = new Date(query.to);
    }

    const limit = query.limit ?? 20;
    const refunds = await Refund.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    return { refunds: refunds.map(toRefundDto), count: refunds.length };
  }

  async function processRefund({ refundId, auth }) {
    return runFinancialTransaction(
      async (session) => {
        const refund = await Refund.findOne({
          _id: refundId,
          merchantId: auth.merchantId,
        }).session(session);
        if (!refund) {
          throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
        }

        if (
          refund.status !== REFUND_STATUS.REQUESTED &&
          refund.status !== REFUND_STATUS.QUEUED
        ) {
          throw new AppError(
            409,
            "INVALID_REFUND_STATE",
            "Refund can only be processed from REQUESTED or QUEUED state",
            { status: refund.status },
          );
        }

        await Refund.updateOne(
          { _id: refund._id },
          { $set: { status: REFUND_STATUS.PROCESSING } },
          { session },
        );

        const result = await orchestrator.initiateRefund({
          auth,
          paymentId: refund.paymentId,
          amountMinor: refund.amountMinor.toString(),
          reason: refund.reason,
          idempotencyKey: refund.idempotencyKey,
        });

        await Refund.updateOne(
          { _id: refund._id },
          {
            $set: {
              status: REFUND_STATUS.QUEUED,
              providerOperationId: result.providerOperation._id,
            },
          },
          { session },
        );

        return {
          refund: toRefundDto(
            await Refund.findById(refund._id).session(session).lean(),
          ),
        };
      },
      {
        reconcile: async () => {
          const refund = await Refund.findById(refundId).lean();
          return refund ? { refund: toRefundDto(refund) } : null;
        },
      },
    );
  }

  async function confirmRefund({
    refundId,
    auth,
    providerEventId,
    amountMinor,
  }) {
    const { confirmTrustedRefund } =
      await import("./ledger/payment-ledger.service.js");

    return runFinancialTransaction(
      async (session) => {
        const refund = await Refund.findOne({
          _id: refundId,
          merchantId: auth.merchantId,
        }).session(session);
        if (!refund) {
          throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
        }

        if (
          refund.status !== REFUND_STATUS.QUEUED &&
          refund.status !== REFUND_STATUS.PROCESSING
        ) {
          throw new AppError(
            409,
            "INVALID_REFUND_STATE",
            "Refund can only be confirmed from QUEUED or PROCESSING state",
            { status: refund.status },
          );
        }

        const payment = await Payment.findOne({
          _id: refund.paymentId,
          merchantId: auth.merchantId,
        }).session(session);
        if (!payment) {
          throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
        }

        const result = await confirmTrustedRefund({
          merchantId: auth.merchantId,
          paymentId: payment._id,
          providerEventId,
          amountMinor,
          actor: "provider",
          isDemo: auth.isDemo,
        });

        await Refund.updateOne(
          { _id: refund._id },
          {
            $set: {
              status: REFUND_STATUS.SUCCEEDED,
              confirmedMinor: BigInt(amountMinor),
              confirmedAt: now(),
              providerOperationId: providerEventId,
              providerReference: result.journal.metadata.providerEventId,
            },
          },
          { session },
        );

        return {
          refund: toRefundDto(
            await Refund.findById(refund._id).session(session).lean(),
          ),
          payment: result.payment,
          journal: result.journal,
        };
      },
      {
        reconcile: async () => {
          const refund = await Refund.findById(refundId).lean();
          return refund ? { refund: toRefundDto(refund) } : null;
        },
      },
    );
  }

  async function failRefund({ refundId, auth, reason, metadata }) {
    return runInTransaction(async (session) => {
      const refund = await Refund.findOne({
        _id: refundId,
        merchantId: auth.merchantId,
      }).session(session);
      if (!refund) {
        throw new AppError(404, "REFUND_NOT_FOUND", "Refund not found");
      }

      if (refund.status === REFUND_STATUS.SUCCEEDED) {
        throw new AppError(
          409,
          "REFUND_ALREADY_SUCCEEDED",
          "Cannot fail a succeeded refund",
        );
      }

      const payment = await Payment.findOne({
        _id: refund.paymentId,
        merchantId: auth.merchantId,
      }).session(session);
      if (!payment) {
        throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
      }

      const capturedMinor = BigInt(
        payment.capturedMinor ?? payment.amountMinor,
      );
      const newRefunded = payment.refundedMinor - refund.amountMinor;
      let nextStatus;
      if (newRefunded === 0n) nextStatus = PAYMENT_STATUS.CAPTURED;
      else if (newRefunded === capturedMinor)
        nextStatus = PAYMENT_STATUS.REFUNDED;
      else nextStatus = PAYMENT_STATUS.PARTIALLY_REFUNDED;

      await Payment.findOneAndUpdate(
        { _id: payment._id, merchantId: auth.merchantId },
        {
          $set: { status: nextStatus, refundedMinor: newRefunded },
          $inc: { version: 1 },
        },
        { session },
      );

      await Refund.updateOne(
        { _id: refund._id },
        {
          $set: {
            status: REFUND_STATUS.FAILED,
            statusReason: reason,
            failedAt: now(),
            failureMetadata: metadata,
            reservedMinor: 0n,
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
          actorRole: "system",
          summary: "Refund failed",
          metadata: { refundId: String(refund._id), reason },
          isDemo: auth.isDemo,
        },
        session,
      );

      return {
        refund: toRefundDto(
          await Refund.findById(refund._id).session(session).lean(),
        ),
      };
    });
  }

  return {
    requestRefund,
    getRefund,
    listRefunds,
    processRefund,
    confirmRefund,
    failRefund,
  };
}

function toRefundDto(refund) {
  return Object.freeze({
    id: String(refund._id),
    paymentId: String(refund.paymentId),
    merchantId: String(refund.merchantId),
    amountMinor: refund.amountMinor?.toString?.() ?? refund.amountMinor,
    currency: refund.currency,
    reason: refund.reason,
    status: refund.status,
    statusReason: refund.statusReason,
    providerOperationId: refund.providerOperationId,
    providerReference: refund.providerReference,
    reservedMinor: refund.reservedMinor?.toString?.() ?? refund.reservedMinor,
    confirmedMinor:
      refund.confirmedMinor?.toString?.() ?? refund.confirmedMinor,
    createdBy: refund.createdBy ? String(refund.createdBy) : null,
    createdAt: refund.createdAt,
    confirmedAt: refund.confirmedAt,
    failedAt: refund.failedAt,
    failureMetadata: refund.failureMetadata,
    isDemo: Boolean(refund.isDemo),
  });
}

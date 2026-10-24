import { LEDGER_EVENT_TYPES, PAYMENT_STATUS } from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { runFinancialTransaction } from "../../lib/transaction.js";
import { Payment } from "../payments/payment.model.js";
import {
  recordPaymentEvent,
  toPaymentDto,
} from "../payments/payment.repository.js";
import { Journal } from "./journal.model.js";
import {
  captureEntries,
  ensureChartOfAccounts,
  postJournal,
  refundEntries,
  toJournalDto,
} from "./ledger.service.js";

async function findCommittedEvent({
  merchantId,
  sourceType,
  sourceId,
  eventType,
}) {
  const journal = await Journal.findOne({
    merchantId,
    sourceType,
    sourceId,
    eventType,
  }).lean();
  if (!journal) return null;
  const payment = await Payment.findOne({
    _id: journal.paymentId ?? journal.metadata?.paymentId,
    merchantId,
  }).lean();
  return payment
    ? {
        payment: toPaymentDto(payment),
        journal: toJournalDto(journal),
        idempotent: true,
      }
    : null;
}

export async function confirmTrustedCapture({
  merchantId,
  paymentId,
  providerEventId,
  actor = "trusted-synthetic-provider-fixture",
  requestId,
  isDemo = false,
  injectFailure = false,
}) {
  const source = {
    merchantId,
    sourceType: "PROVIDER_CAPTURE",
    sourceId: providerEventId,
    eventType: LEDGER_EVENT_TYPES.CAPTURE,
  };

  return runFinancialTransaction(
    async (session) => {
      const replay = await Journal.findOne(source).session(session);
      if (replay) {
        if (
          String(replay.paymentId ?? replay.metadata?.paymentId) !==
          String(paymentId)
        ) {
          throw new AppError(
            409,
            "PROVIDER_EVENT_CONFLICT",
            "Provider event is already linked to another payment",
          );
        }
        const payment = await Payment.findOne({ _id: paymentId, merchantId })
          .session(session)
          .lean();
        return {
          payment: toPaymentDto(payment),
          journal: toJournalDto(replay),
          idempotent: true,
        };
      }

      const payment = await Payment.findOne({
        _id: paymentId,
        merchantId,
      }).session(session);
      if (!payment)
        throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
      if (payment.status !== PAYMENT_STATUS.CAPTURING) {
        throw new AppError(
          409,
          "CAPTURE_CONFIRMATION_NOT_ALLOWED",
          "Only a CAPTURING payment can be confirmed as captured",
          { status: payment.status },
        );
      }

      const accounts = await ensureChartOfAccounts({
        merchantId,
        currency: payment.currency,
        session,
        isDemo,
      });
      const updated = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          merchantId,
          status: PAYMENT_STATUS.CAPTURING,
          version: payment.version,
        },
        {
          $set: {
            status: PAYMENT_STATUS.CAPTURED,
            capturedMinor: payment.amountMinor,
          },
          $inc: { version: 1 },
        },
        { returnDocument: "after", session },
      );
      if (!updated)
        throw new AppError(
          409,
          "PAYMENT_CONCURRENCY_CONFLICT",
          "Payment changed during capture confirmation",
        );

      const posted = await postJournal({
        ...source,
        paymentId: payment._id,
        currency: payment.currency,
        entries: captureEntries(accounts, payment.amountMinor),
        session,
        description: `Confirmed capture for ${payment.reference}`,
        createdBy: actor,
        requestId,
        metadata: { paymentId: String(payment._id), providerEventId },
        isDemo,
        injectFailure,
      });
      await recordPaymentEvent(
        {
          paymentId: payment._id,
          merchantId,
          eventType: "payment.capture.confirmed",
          fromStatus: PAYMENT_STATUS.CAPTURING,
          toStatus: PAYMENT_STATUS.CAPTURED,
          actorRole: actor,
          summary: "Trusted synthetic capture confirmed and journal posted",
          metadata: {
            providerEventId,
            journalReference: posted.journal.journalReference,
          },
          isDemo,
        },
        session,
      );
      return {
        payment: toPaymentDto(updated),
        journal: posted.journal,
        idempotent: false,
      };
    },
    { reconcile: () => findCommittedEvent(source) },
  );
}

export async function confirmTrustedRefund({
  merchantId,
  paymentId,
  providerEventId,
  amountMinor,
  actor = "trusted-synthetic-provider-fixture",
  requestId,
  isDemo = false,
  injectFailure = false,
}) {
  const refundAmount = BigInt(amountMinor);
  if (refundAmount <= 0n)
    throw new AppError(
      422,
      "INVALID_REFUND_AMOUNT",
      "Refund amount must be positive",
    );
  const source = {
    merchantId,
    sourceType: "PROVIDER_REFUND",
    sourceId: providerEventId,
    eventType: LEDGER_EVENT_TYPES.REFUND,
  };

  return runFinancialTransaction(
    async (session) => {
      const replay = await Journal.findOne(source).session(session);
      if (replay) {
        if (
          String(replay.paymentId ?? replay.metadata?.paymentId) !==
          String(paymentId)
        ) {
          throw new AppError(
            409,
            "PROVIDER_EVENT_CONFLICT",
            "Provider event is already linked to another payment",
          );
        }
        const payment = await Payment.findOne({ _id: paymentId, merchantId })
          .session(session)
          .lean();
        return {
          payment: toPaymentDto(payment),
          journal: toJournalDto(replay),
          idempotent: true,
        };
      }

      const payment = await Payment.findOne({
        _id: paymentId,
        merchantId,
      }).session(session);
      if (!payment)
        throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
      const allowed = [
        PAYMENT_STATUS.CAPTURED,
        PAYMENT_STATUS.REFUND_PENDING,
        PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ];
      if (!allowed.includes(payment.status)) {
        throw new AppError(
          409,
          "REFUND_CONFIRMATION_NOT_ALLOWED",
          "Payment state cannot accept a confirmed refund",
          { status: payment.status },
        );
      }
      const capturedMinor = BigInt(
        payment.capturedMinor ?? payment.amountMinor,
      );
      const remaining = capturedMinor - payment.refundedMinor;
      if (refundAmount > remaining) {
        throw new AppError(
          409,
          "REFUND_EXCEEDS_CAPTURE",
          "Confirmed refunds cannot exceed the captured amount",
          {
            refundableMinor: remaining.toString(),
          },
        );
      }

      const captureJournal = await Journal.findOne({
        merchantId,
        sourceType: "PROVIDER_CAPTURE",
        eventType: LEDGER_EVENT_TYPES.CAPTURE,
        $or: [
          { paymentId: payment._id },
          { "metadata.paymentId": String(payment._id) },
        ],
      }).session(session);
      if (!captureJournal)
        throw new AppError(
          409,
          "CAPTURE_JOURNAL_MISSING",
          "Refund cannot post without its capture journal",
        );

      const newRefunded = payment.refundedMinor + refundAmount;
      const nextStatus =
        newRefunded === capturedMinor
          ? PAYMENT_STATUS.REFUNDED
          : PAYMENT_STATUS.PARTIALLY_REFUNDED;
      const updated = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          merchantId,
          version: payment.version,
          refundedMinor: payment.refundedMinor,
          status: { $in: allowed },
        },
        {
          $set: { status: nextStatus, refundedMinor: newRefunded },
          $inc: { version: 1 },
        },
        { returnDocument: "after", session },
      );
      if (!updated)
        throw new AppError(
          409,
          "PAYMENT_CONCURRENCY_CONFLICT",
          "Payment changed during refund confirmation",
        );

      const accounts = await ensureChartOfAccounts({
        merchantId,
        currency: payment.currency,
        session,
        isDemo,
      });
      const posted = await postJournal({
        ...source,
        paymentId: payment._id,
        currency: payment.currency,
        entries: refundEntries(accounts, refundAmount),
        session,
        description: `Confirmed refund for ${payment.reference}`,
        createdBy: actor,
        requestId,
        metadata: {
          paymentId: String(payment._id),
          providerEventId,
          amountMinor: refundAmount.toString(),
        },
        reversalOfJournalId: captureJournal._id,
        isDemo,
        injectFailure,
      });
      await recordPaymentEvent(
        {
          paymentId: payment._id,
          merchantId,
          eventType: "payment.refund.confirmed",
          fromStatus: payment.status,
          toStatus: nextStatus,
          actorRole: actor,
          summary: "Trusted synthetic refund confirmed and journal posted",
          metadata: {
            providerEventId,
            amountMinor: refundAmount.toString(),
            journalReference: posted.journal.journalReference,
          },
          isDemo,
        },
        session,
      );
      return {
        payment: toPaymentDto(updated),
        journal: posted.journal,
        idempotent: false,
      };
    },
    { reconcile: () => findCommittedEvent(source) },
  );
}


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

function parseAmount(value, code = "INVALID_AMOUNT") {
  let parsed;

  try {
    parsed = BigInt(value);
  } catch {
    throw new AppError(
      422,
      code,
      "Amount must be a positive integer",
    );
  }

  if (parsed <= 0n) {
    throw new AppError(
      422,
      code,
      "Amount must be greater than zero",
    );
  }

  return parsed;
}

function validateProviderEventId(providerEventId) {
  if (
    typeof providerEventId !== "string" ||
    !providerEventId.trim() ||
    providerEventId.length > 128
  ) {
    throw new AppError(
      422,
      "INVALID_PROVIDER_EVENT_ID",
      "A valid provider event ID is required",
    );
  }

  return providerEventId;
}

function journalPaymentId(journal) {
  return journal.paymentId ?? journal.metadata?.paymentId;
}

function assertJournalOwnership(journal, paymentId) {
  if (String(journalPaymentId(journal)) !== String(paymentId)) {
    throw new AppError(
      409,
      "PROVIDER_EVENT_CONFLICT",
      "Provider event is already linked to another payment",
    );
  }
}

async function loadPayment({ merchantId, paymentId, session }) {
  const query = Payment.findOne({
    _id: paymentId,
    merchantId,
  });

  if (session) query.session(session);

  const payment = await query;

  if (!payment) {
    throw new AppError(
      404,
      "PAYMENT_NOT_FOUND",
      "Payment not found",
    );
  }

  return payment;
}

async function findCommittedEvent({
  merchantId,
  paymentId,
  sourceType,
  sourceId,
  eventType,
  expectedAmount,
}) {
  const journal = await Journal.findOne({
    merchantId,
    sourceType,
    sourceId,
    eventType,
  }).lean();

  if (!journal) return null;

  assertJournalOwnership(journal, paymentId);

  if (
    expectedAmount != null &&
    journal.metadata?.amountMinor != null &&
    BigInt(journal.metadata.amountMinor) !== expectedAmount
  ) {
    throw new AppError(
      409,
      "PROVIDER_EVENT_CONFLICT",
      "Provider event was previously recorded with a different amount",
    );
  }

  const payment = await loadPayment({
    merchantId,
    paymentId,
  });

  return {
    payment: toPaymentDto(payment),
    journal: toJournalDto(journal),
    idempotent: true,
  };
}

async function checkReplay({
  session,
  source,
  merchantId,
  paymentId,
  expectedAmount,
}) {
  const existing = await Journal.findOne(source)
    .session(session)
    .lean();

  if (!existing) return null;

  assertJournalOwnership(existing, paymentId);

  if (
    expectedAmount != null &&
    existing.metadata?.amountMinor != null &&
    BigInt(existing.metadata.amountMinor) !== expectedAmount
  ) {
    throw new AppError(
      409,
      "PROVIDER_EVENT_CONFLICT",
      "Provider event was previously recorded with a different amount",
    );
  }

  const payment = await loadPayment({
    merchantId,
    paymentId,
    session,
  });

  return {
    payment: toPaymentDto(payment),
    journal: toJournalDto(existing),
    idempotent: true,
  };
}

export async function confirmTrustedCapture({
  merchantId,
  paymentId,
  providerEventId,
  amountMinor,
  actor = "trusted-synthetic-provider-fixture",
  requestId,
  isDemo = false,
  injectFailure = false,
}) {
  const source = {
    merchantId,
    sourceType: "PROVIDER_CAPTURE",
    sourceId: validateProviderEventId(providerEventId),
    eventType: LEDGER_EVENT_TYPES.CAPTURE,
  };

  return runFinancialTransaction(
    async (session) => {
      const replay = await checkReplay({
        session,
        source,
        merchantId,
        paymentId,
        expectedAmount:
          amountMinor == null ? undefined : parseAmount(amountMinor),
      });

      if (replay) return replay;

      const payment = await loadPayment({
        merchantId,
        paymentId,
        session,
      });

      if (
        ![
          PAYMENT_STATUS.CAPTURING,
          PAYMENT_STATUS.UNKNOWN,
        ].includes(payment.status)
      ) {
        throw new AppError(
          409,
          "CAPTURE_CONFIRMATION_NOT_ALLOWED",
          "Payment state cannot accept capture confirmation",
          { status: payment.status },
        );
      }

      const authorizedAmount = BigInt(payment.amountMinor);
      const capturedBefore = BigInt(payment.capturedMinor ?? 0n);

      const captureAmount = parseAmount(
        amountMinor ?? authorizedAmount,
        "INVALID_CAPTURE_AMOUNT",
      );

      if (
        capturedBefore > 0n ||
        captureAmount > authorizedAmount
      ) {
        throw new AppError(
          409,
          "CAPTURE_EXCEEDS_AUTHORIZATION",
          "Capture amount exceeds the available authorized amount",
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
          status: payment.status,
          version: payment.version,
          capturedMinor: payment.capturedMinor,
        },
        {
          $set: {
            status: PAYMENT_STATUS.CAPTURED,
            statusReason: null,
            capturedMinor: captureAmount,
          },
          $inc: { version: 1 },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!updated) {
        throw new AppError(
          409,
          "PAYMENT_CONCURRENCY_CONFLICT",
          "Payment changed during capture confirmation",
        );
      }

      const posted = await postJournal({
        ...source,
        paymentId: payment._id,
        currency: payment.currency,
        entries: captureEntries(accounts, captureAmount),
        session,
        description: `Confirmed capture for ${payment.reference}`,
        createdBy: actor,
        requestId,
        metadata: {
          paymentId: String(payment._id),
          providerEventId,
          amountMinor: captureAmount.toString(),
        },
        isDemo,
        injectFailure,
      });

      await recordPaymentEvent(
        {
          paymentId: payment._id,
          merchantId,
          eventType: "payment.capture.confirmed",
          fromStatus: payment.status,
          toStatus: PAYMENT_STATUS.CAPTURED,
          actorRole: actor,
          summary: "Trusted synthetic capture confirmed and journal posted",
          metadata: {
            providerEventId,
            amountMinor: captureAmount.toString(),
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
    {
      reconcile: () =>
        findCommittedEvent({
          ...source,
          paymentId,
          expectedAmount:
            amountMinor == null ? undefined : parseAmount(amountMinor),
        }),
    },
  );
}

export async function confirmTrustedRefund({
  merchantId,
  paymentId,
  providerEventId,
  amountMinor,
  refundId,
  actor = "trusted-synthetic-provider-fixture",
  requestId,
  isDemo = false,
  injectFailure = false,
}) {
  const refundAmount = parseAmount(
    amountMinor,
    "INVALID_REFUND_AMOUNT",
  );

  const source = {
    merchantId,
    sourceType: "PROVIDER_REFUND",
    sourceId: validateProviderEventId(providerEventId),
    eventType: LEDGER_EVENT_TYPES.REFUND,
  };

  return runFinancialTransaction(
    async (session) => {
      const replay = await checkReplay({
        session,
        source,
        merchantId,
        paymentId,
        expectedAmount: refundAmount,
      });

      if (replay) return replay;

      const payment = await loadPayment({
        merchantId,
        paymentId,
        session,
      });

      const allowedStatuses = [
        PAYMENT_STATUS.CAPTURED,
        PAYMENT_STATUS.REFUND_PENDING,
        PAYMENT_STATUS.PARTIALLY_REFUNDED,
      ];

      if (!allowedStatuses.includes(payment.status)) {
        throw new AppError(
          409,
          "REFUND_CONFIRMATION_NOT_ALLOWED",
          "Payment state cannot accept a confirmed refund",
          { status: payment.status },
        );
      }

      const capturedMinor = BigInt(payment.capturedMinor ?? 0n);
      const refundedMinor = BigInt(payment.refundedMinor ?? 0n);

      if (capturedMinor <= 0n) {
        throw new AppError(
          409,
          "PAYMENT_NOT_CAPTURED",
          "Payment has no captured funds available for refund",
        );
      }

      const remaining = capturedMinor - refundedMinor;

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
      })
        .sort({ createdAt: 1, _id: 1 })
        .session(session);

      if (!captureJournal) {
        throw new AppError(
          409,
          "CAPTURE_JOURNAL_MISSING",
          "Refund cannot be posted without a confirmed capture journal",
        );
      }

      const newRefunded = refundedMinor + refundAmount;

      const nextStatus =
        newRefunded === capturedMinor
          ? PAYMENT_STATUS.REFUNDED
          : PAYMENT_STATUS.PARTIALLY_REFUNDED;

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
          version: payment.version,
          status: { $in: allowedStatuses },
          refundedMinor: payment.refundedMinor,
        },
        {
          $set: {
            status: nextStatus,
            statusReason: null,
            refundedMinor: newRefunded,
          },
          $inc: { version: 1 },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!updated) {
        throw new AppError(
          409,
          "PAYMENT_CONCURRENCY_CONFLICT",
          "Payment changed during refund confirmation",
        );
      }

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

      if (refundId) {
        const { Refund } = await import("../payments/refund.model.js");
        const refundUpdate = await Refund.updateOne(
          {
            _id: refundId,
            merchantId,
            paymentId: payment._id,
            status: { $ne: "SUCCEEDED" },
          },
          {
            $set: {
              status: "SUCCEEDED",
              confirmedMinor: refundAmount,
              confirmedAt: new Date(),
              providerOperationId: providerEventId,
              providerReference: providerEventId,
              reservedMinor: 0n,
            },
          },
          { session },
        );

        if (refundUpdate.matchedCount !== 1) {
          throw new AppError(
            409,
            "REFUND_STATE_CONFLICT",
            "Refund state changed during confirmation",
          );
        }
      }

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
    {
      reconcile: () =>
        findCommittedEvent({
          ...source,
          paymentId,
          expectedAmount: refundAmount,
        }),
    },
  );
}

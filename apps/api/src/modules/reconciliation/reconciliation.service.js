import { AppError } from "../../lib/errors.js";
import {
  RECONCILIATION_RECORD_STATUS,
  RECONCILIATION_CASE_STATUS,
  ReconciliationRecord,
  ReconciliationCase,
} from "./reconciliation-record.model.js";
import { Payment } from "../payments/payment.model.js";
import { ProviderOperation } from "../payments/operations/provider-operation.model.js";
import { Journal } from "../ledger/journal.model.js";

function dto(record) {
  return {
    id: String(record._id),
    paymentId: record.paymentId ? String(record.paymentId) : null,
    providerReference: record.providerReference ?? null,
    internalPaymentStatus: record.internalPaymentStatus ?? null,
    externalProviderStatus: record.externalProviderStatus ?? null,
    expectedAmountMinor: record.expectedAmountMinor?.toString?.() ?? null,
    observedAmountMinor: record.observedAmountMinor?.toString?.() ?? null,
    currency: record.currency,
    status: record.status,
    attemptCount: record.attemptCount,
    lastCheckedAt: record.lastCheckedAt ?? null,
    resolutionMetadata: record.resolutionMetadata ?? null,
    isSyntheticFixture: Boolean(record.isSyntheticFixture),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function caseDto(record) {
  return {
    id: String(record._id),
    merchantId: String(record.merchantId),
    paymentId: record.paymentId ? String(record.paymentId) : null,
    refundId: record.refundId ? String(record.refundId) : null,
    type: record.type,
    status: record.status,
    discrepancies: record.discrepancies ?? [],
    resolutionAction: record.resolutionAction ?? null,
    resolutionMetadata: record.resolutionMetadata ?? null,
    attemptCount: record.attemptCount,
    lastCheckedAt: record.lastCheckedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function getDiscrepancyType(
  internalStatus,
  externalStatus,
  internalAmount,
  externalAmount,
  currency,
  internalCurrency,
  hasJournal,
) {
  const discrepancies = [];

  if (!externalStatus) {
    discrepancies.push({
      type: "MISSING_PROVIDER_OPERATION",
      severity: "HIGH",
    });
  }
  if (!internalStatus) {
    discrepancies.push({ type: "MISSING_INTERNAL_PAYMENT", severity: "HIGH" });
  }
  if (internalAmount && externalAmount && internalAmount !== externalAmount) {
    discrepancies.push({
      type: "AMOUNT_MISMATCH",
      severity: "HIGH",
      internal: internalAmount,
      external: externalAmount,
    });
  }
  if (currency && internalCurrency && currency !== internalCurrency) {
    discrepancies.push({
      type: "CURRENCY_MISMATCH",
      severity: "HIGH",
      internal: internalCurrency,
      external: currency,
    });
  }
  if (internalStatus && externalStatus && internalStatus !== externalStatus) {
    discrepancies.push({
      type: "STATUS_MISMATCH",
      severity: "MEDIUM",
      internal: internalStatus,
      external: externalStatus,
    });
  }
  if (internalStatus === "CAPTURED" && !hasJournal) {
    discrepancies.push({ type: "MISSING_CAPTURE_JOURNAL", severity: "HIGH" });
  }

  return discrepancies;
}

export async function listReconciliationRecords({ auth, query }) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = { merchantId: auth.merchantId };
  if (query.status) filter.status = query.status;
  const [items, total, statusCounts] = await Promise.all([
    ReconciliationRecord.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ReconciliationRecord.countDocuments(filter),
    ReconciliationRecord.aggregate([
      { $match: { merchantId: auth.merchantId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  const summary = Object.fromEntries(
    RECONCILIATION_RECORD_STATUS.map((status) => [status, 0]),
  );
  for (const row of statusCounts) summary[row._id] = row.count;
  return {
    items: items.map(dto),
    page,
    limit,
    total,
    summary,
    liveProviderReconciliation: true,
  };
}

export async function getReconciliationRecord({ auth, recordId }) {
  const record = await ReconciliationRecord.findOne({
    _id: recordId,
    merchantId: auth.merchantId,
  }).lean();
  if (!record)
    throw new AppError(
      404,
      "RECONCILIATION_NOT_FOUND",
      "Reconciliation record not found",
    );
  return dto(record);
}

export async function listReconciliationCases({ auth, query }) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = { merchantId: auth.merchantId };
  if (query.status) filter.status = query.status;
  const [items, total, statusCounts] = await Promise.all([
    ReconciliationCase.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ReconciliationCase.countDocuments(filter),
    ReconciliationCase.aggregate([
      { $match: { merchantId: auth.merchantId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  const summary = Object.fromEntries(
    RECONCILIATION_CASE_STATUS.map((status) => [status, 0]),
  );
  for (const row of statusCounts) summary[row._id] = row.count;
  return {
    items: items.map(caseDto),
    page,
    limit,
    total,
    summary,
  };
}

export async function getReconciliationCase({ auth, caseId }) {
  const record = await ReconciliationCase.findOne({
    _id: caseId,
    merchantId: auth.merchantId,
  }).lean();
  if (!record)
    throw new AppError(
      404,
      "RECONCILIATION_CASE_NOT_FOUND",
      "Reconciliation case not found",
    );
  return caseDto(record);
}

export async function checkPaymentReconciliation({
  auth,
  paymentId,
  _config,
  _logger,
}) {
  const payment = await Payment.findOne({
    _id: paymentId,
    merchantId: auth.merchantId,
  }).lean();
  if (!payment) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }

  const providerOps = await ProviderOperation.find({
    paymentId,
    merchantId: auth.merchantId,
  }).lean();
  const captureJournal = await Journal.findOne({
    merchantId: auth.merchantId,
    sourceType: "PROVIDER_CAPTURE",
    eventType: "CAPTURE",
    $or: [
      { paymentId: payment._id },
      { "metadata.paymentId": String(payment._id) },
    ],
  }).lean();

  let externalStatus = null;
  let externalAmount = null;
  let externalCurrency = null;

  const authOp = providerOps.find((op) => op.type === "AUTHORIZE");
  if (authOp) {
    externalStatus = authOp.state;
  }
  const captureOp = providerOps.find((op) => op.type === "CAPTURE");
  if (captureOp) {
    externalStatus = captureOp.state;
    externalAmount = captureOp.amountMinor?.toString();
    externalCurrency = captureOp.currency;
  }
  const refundOp = providerOps.find((op) => op.type === "REFUND");
  if (refundOp) {
    externalStatus = refundOp.state;
    externalAmount = refundOp.amountMinor?.toString();
    externalCurrency = refundOp.currency;
  }

  const discrepancies = getDiscrepancyType(
    payment.status,
    externalStatus,
    payment.amountMinor?.toString(),
    externalAmount,
    externalCurrency,
    payment.currency,
    !!captureJournal,
  );

  const status = discrepancies.length === 0 ? "MATCHED" : "DISCREPANCY_FOUND";

  const record = await ReconciliationRecord.findOneAndUpdate(
    { paymentId: payment._id, merchantId: auth.merchantId },
    {
      $set: {
        paymentId: payment._id,
        merchantId: auth.merchantId,
        providerReference:
          captureOp?.providerReference ?? authOp?.providerReference,
        internalPaymentStatus: payment.status,
        externalProviderStatus: externalStatus,
        expectedAmountMinor: payment.amountMinor,
        observedAmountMinor: externalAmount ? BigInt(externalAmount) : null,
        currency: payment.currency,
        status,
        attemptCount: 1,
        lastCheckedAt: new Date(),
        resolutionMetadata: { discrepancies },
        isSyntheticFixture: false,
      },
    },
    { upsert: true, returnDocument: "after" },
  ).lean();

  if (discrepancies.length > 0) {
    await ReconciliationCase.findOneAndUpdate(
      {
        paymentId: payment._id,
        merchantId: auth.merchantId,
        status: { $in: ["OPEN", "IN_PROGRESS"] },
      },
      {
        $set: {
          paymentId: payment._id,
          merchantId: auth.merchantId,
          type: "PAYMENT",
          status: "OPEN",
          discrepancies,
          attemptCount: 1,
          lastCheckedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" },
    ).lean();
  }

  return { record: dto(record), discrepancies, status };
}

export async function checkRefundReconciliation({
  _auth,
  _refundId,
  _config,
  _logger,
}) {
  // Similar implementation for refund reconciliation
  return { discrepancies: [], status: "NOT_IMPLEMENTED" };
}

export async function runScheduledReconciliation({ _config, _logger }) {
  // This would be called by a scheduled job
  // For now, return a summary
  return { checked: 0, discrepanciesFound: 0 };
}

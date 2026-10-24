import { AppError } from "../../lib/errors.js";
import {
  RECONCILIATION_RECORD_STATUS,
  ReconciliationRecord,
} from "./reconciliation-record.model.js";

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
    liveProviderReconciliation: false,
    fixtureNotice:
      "Records are trusted synthetic reconciliation fixtures. No live provider lookup is performed.",
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

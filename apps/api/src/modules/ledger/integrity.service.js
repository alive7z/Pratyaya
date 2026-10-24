import {
  LEDGER_EVENT_TYPES,
  LEDGER_SIDES,
  PAYMENT_STATUS,
} from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { recordAudit } from "../audit/audit.service.js";
import { Payment } from "../payments/payment.model.js";
import { IntegrityReport } from "./integrity-report.model.js";
import { Journal } from "./journal.model.js";
import { LedgerAccount } from "./ledger-account.model.js";

function finding({
  checkId,
  checkName,
  affected,
  severity,
  diagnostics,
  remediation,
  inconclusive = false,
}) {
  return {
    checkId,
    checkName,
    status: inconclusive ? "INCONCLUSIVE" : affected.length ? "FAIL" : "PASS",
    affectedRecords: affected.length,
    severity,
    executedAt: new Date(),
    diagnostics: { recordIds: affected.slice(0, 50), ...diagnostics },
    remediation,
  };
}

function sum(entries, side) {
  return entries
    .filter((entry) => entry.direction === side)
    .reduce((total, entry) => total + BigInt(entry.amountMinor), 0n);
}

function sourceKey(journal) {
  return `${journal.sourceType}|${journal.sourceId}|${journal.eventType}`;
}

function paymentIdOf(journal) {
  return journal.paymentId
    ? String(journal.paymentId)
    : journal.metadata?.paymentId
      ? String(journal.metadata.paymentId)
      : null;
}

function journalTotal(entries) {
  return sum(entries, LEDGER_SIDES.DEBIT);
}

function financialStatusFor(status) {
  return [
    PAYMENT_STATUS.CAPTURED,
    PAYMENT_STATUS.REFUND_PENDING,
    PAYMENT_STATUS.PARTIALLY_REFUNDED,
    PAYMENT_STATUS.REFUNDED,
  ].includes(status);
}

export async function executeIntegrityCheck({
  auth,
  currency,
  requestId,
  req,
  config,
}) {
  const merchantId = auth.merchantId;
  const journalFilter = { merchantId };
  const accountFilter = { merchantId };
  if (currency) {
    journalFilter.currency = currency;
    accountFilter.currency = currency;
  }

  let journals;
  let accounts;
  let payments;
  try {
    [journals, accounts, payments] = await Promise.all([
      Journal.find(journalFilter).lean(),
      LedgerAccount.find(accountFilter).lean(),
      Payment.find({
        merchantId,
        ...(currency ? { currency } : {}),
      }).lean(),
    ]);
  } catch {
    const check = finding({
      checkId: "integrity-data-access",
      checkName: "Integrity data access",
      affected: [],
      severity: "CRITICAL",
      inconclusive: true,
      diagnostics: { reason: "Required records could not be read" },
      remediation: "Restore database availability and rerun the verification.",
    });
    return persistReport({ auth, currency, requestId, checks: [check] });
  }

  const accountMap = new Map(
    accounts.map((account) => [String(account._id), account]),
  );
  const paymentMap = new Map(
    payments.map((payment) => [String(payment._id), payment]),
  );
  const unbalanced = journals.filter(
    (journal) =>
      sum(journal.entries, LEDGER_SIDES.DEBIT) !==
      sum(journal.entries, LEDGER_SIDES.CREDIT),
  );
  const sourceCounts = new Map();
  for (const journal of journals)
    sourceCounts.set(
      sourceKey(journal),
      (sourceCounts.get(sourceKey(journal)) ?? 0) + 1,
    );
  const duplicateSources = [...sourceCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const invalidAccounts = [];
  const currencyMismatches = [];
  for (const journal of journals) {
    for (const entry of journal.entries) {
      const account = accountMap.get(String(entry.accountId));
      if (!account || String(account.merchantId) !== String(merchantId))
        invalidAccounts.push(String(journal._id));
      else if (account.currency !== journal.currency)
        currencyMismatches.push(String(journal._id));
    }
  }

  const captureByPayment = new Map();
  const captureAmountMismatches = [];
  for (const journal of journals.filter(
    (item) => item.eventType === LEDGER_EVENT_TYPES.CAPTURE,
  )) {
    const paymentId = paymentIdOf(journal);
    if (paymentId) {
      captureByPayment.set(paymentId, journal);
      const payment = paymentMap.get(paymentId);
      if (payment) {
        const expected = BigInt(
          payment.capturedMinor ??
            (financialStatusFor(payment.status) ? payment.amountMinor : 0n),
        );
        if (journalTotal(journal.entries) !== expected)
          captureAmountMismatches.push(String(journal._id));
      }
    }
  }
  const financialStatuses = new Set([
    PAYMENT_STATUS.CAPTURED,
    PAYMENT_STATUS.REFUND_PENDING,
    PAYMENT_STATUS.PARTIALLY_REFUNDED,
    PAYMENT_STATUS.REFUNDED,
  ]);
  const missingCapture = payments
    .filter(
      (payment) =>
        financialStatuses.has(payment.status) &&
        !captureByPayment.has(String(payment._id)),
    )
    .map((payment) => String(payment._id));
  const unexpectedEntries = journals
    .filter((journal) => {
      const paymentId = paymentIdOf(journal);
      const payment = paymentId ? paymentMap.get(paymentId) : null;
      return payment && !financialStatuses.has(payment.status);
    })
    .map((journal) => String(journal._id));
  const invalidReversals = journals
    .filter((journal) => journal.eventType === LEDGER_EVENT_TYPES.REFUND)
    .filter((journal) => {
      const original = journals.find(
        (candidate) =>
          String(candidate._id) === String(journal.reversalOfJournalId),
      );
      return (
        !original ||
        original.eventType !== LEDGER_EVENT_TYPES.CAPTURE ||
        original.currency !== journal.currency ||
        (paymentIdOf(original) !== null &&
          paymentIdOf(original) !== paymentIdOf(journal))
      );
    })
    .map((journal) => String(journal._id));
  const refundLedgerTotals = new Map();
  for (const journal of journals.filter(
    (item) => item.eventType === LEDGER_EVENT_TYPES.REFUND,
  )) {
    const paymentId = paymentIdOf(journal);
    if (!paymentId) continue;
    refundLedgerTotals.set(
      paymentId,
      (refundLedgerTotals.get(paymentId) ?? 0n) + journalTotal(journal.entries),
    );
  }
  const refundLedgerMismatches = payments
    .filter((payment) => {
      const ledgerTotal = refundLedgerTotals.get(String(payment._id)) ?? 0n;
      return ledgerTotal !== BigInt(payment.refundedMinor ?? 0);
    })
    .map((payment) => String(payment._id));
  const excessiveRefunds = payments
    .filter(
      (payment) =>
        BigInt(payment.refundedMinor ?? 0) >
        BigInt(payment.capturedMinor ?? payment.amountMinor),
    )
    .map((payment) => String(payment._id));
  const mismatchedReferences = journals
    .filter((journal) => {
      const paymentId = paymentIdOf(journal);
      return paymentId && !paymentMap.has(paymentId);
    })
    .map((journal) => String(journal._id));

  const checks = [
    finding({
      checkId: "balanced-journals",
      checkName: "Balanced journals",
      affected: unbalanced.map((row) => String(row._id)),
      severity: "CRITICAL",
      remediation:
        "Investigate the source workflow and post an authorized compensating journal; never edit the posted journal.",
    }),
    finding({
      checkId: "duplicate-source-events",
      checkName: "Duplicate source-event postings",
      affected: duplicateSources,
      severity: "CRITICAL",
      remediation:
        "Stop posting for the affected source and inspect unique-index and transaction history.",
    }),
    finding({
      checkId: "capture-journal-presence",
      checkName: "Captured payments have capture journals",
      affected: missingCapture,
      severity: "CRITICAL",
      remediation:
        "Reconcile the trusted provider event before any accounting correction.",
    }),
    finding({
      checkId: "capture-amounts",
      checkName: "Capture journals match captured amounts",
      affected: captureAmountMismatches,
      severity: "CRITICAL",
      remediation:
        "Reconcile the trusted provider event and payment snapshot before posting any correction.",
    }),
    finding({
      checkId: "non-financial-state-entries",
      checkName: "Non-financial states have no ledger movement",
      affected: unexpectedEntries,
      severity: "HIGH",
      remediation:
        "Investigate state history and use an approved compensating journal if required.",
    }),
    finding({
      checkId: "account-references",
      checkName: "Ledger account references and ownership",
      affected: [...new Set(invalidAccounts)],
      severity: "CRITICAL",
      remediation:
        "Restore the referenced account definition or isolate the corrupt journal for review.",
    }),
    finding({
      checkId: "currency-consistency",
      checkName: "Journal and account currency consistency",
      affected: [...new Set(currencyMismatches)],
      severity: "CRITICAL",
      remediation:
        "Do not convert or rewrite amounts; investigate and post an authorized correction.",
    }),
    finding({
      checkId: "reversal-relationships",
      checkName: "Refund reversal relationships",
      affected: invalidReversals,
      severity: "HIGH",
      remediation:
        "Link future refunds to the original capture journal and review affected records.",
    }),
    finding({
      checkId: "refund-ledger-totals",
      checkName: "Posted refund journals match payment totals",
      affected: refundLedgerMismatches,
      severity: "CRITICAL",
      remediation:
        "Block further refunds and reconcile provider, payment, and ledger history.",
    }),
    finding({
      checkId: "refund-limits",
      checkName: "Refund totals do not exceed captures",
      affected: excessiveRefunds,
      severity: "CRITICAL",
      remediation:
        "Block further refunds and reconcile provider and payment history.",
    }),
    finding({
      checkId: "payment-journal-references",
      checkName: "Payment and journal references",
      affected: mismatchedReferences,
      severity: "HIGH",
      remediation:
        "Investigate missing payment records without mutating posted journals.",
    }),
    finding({
      checkId: "snapshot-consistency",
      checkName: "Snapshot versus journal consistency",
      affected: [],
      severity: "INFO",
      inconclusive: true,
      diagnostics: {
        reason: "Balance snapshots are intentionally not implemented",
      },
      remediation:
        "No action required; balances are derived from posted journals.",
    }),
  ];

  const report = await persistReport({ auth, currency, requestId, checks });
  await recordAudit(
    {
      action: "ledger.integrity.executed",
      actorUserId: auth.user?._id,
      actorRole: auth.role,
      merchantId,
      resourceType: "integrity_report",
      resourceId: report.id,
      req,
      metadata: { status: report.status, currency: currency ?? "ALL" },
      isDemo: auth.isDemo,
    },
    { secret: config.auth.jwtSecret },
  );
  return report;
}

async function persistReport({ auth, currency, requestId, checks }) {
  const summary = {
    passed: checks.filter((check) => check.status === "PASS").length,
    failed: checks.filter((check) => check.status === "FAIL").length,
    inconclusive: checks.filter((check) => check.status === "INCONCLUSIVE")
      .length,
    byCheck: Object.fromEntries(
      checks.map((check) => [check.checkId, check.status]),
    ),
    bySeverity: Object.fromEntries(
      ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((severity) => [
        severity,
        checks.filter((check) => check.severity === severity).length,
      ]),
    ),
  };
  const status = summary.failed
    ? "FAIL"
    : summary.inconclusive
      ? "INCONCLUSIVE"
      : "PASS";
  const report = await IntegrityReport.create({
    merchantId: auth.merchantId,
    currency,
    status,
    summary,
    checks,
    requestedBy: String(auth.user?._id ?? auth.role),
    requestId,
    isDemo: auth.isDemo,
    executedAt: new Date(),
  });
  return toIntegrityReportDto(report);
}

export function toIntegrityReportDto(report) {
  return {
    id: String(report._id),
    merchantId: String(report.merchantId),
    currency: report.currency ?? null,
    status: report.status,
    summary: report.summary,
    checks: report.checks,
    executedAt: report.executedAt,
    createdAt: report.createdAt,
    scopeNotice:
      "Results cover only the merchant, currency, records, and checks examined; they are not an absolute guarantee of system correctness.",
  };
}

export async function listIntegrityReports({ auth, query }) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter = { merchantId: auth.merchantId };
  if (query.currency) filter.currency = query.currency;
  const [items, total] = await Promise.all([
    IntegrityReport.find(filter)
      .sort({ executedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    IntegrityReport.countDocuments(filter),
  ]);
  return { items: items.map(toIntegrityReportDto), page, limit, total };
}

export async function getIntegrityReport({ auth, reportId }) {
  const report = await IntegrityReport.findOne({
    _id: reportId,
    merchantId: auth.merchantId,
  }).lean();
  if (!report)
    throw new AppError(
      404,
      "INTEGRITY_REPORT_NOT_FOUND",
      "Integrity report not found",
    );
  return toIntegrityReportDto(report);
}

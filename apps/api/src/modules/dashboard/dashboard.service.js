import { PAYMENT_STATUS, ROLES } from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { AuditLog } from "../audit/audit.model.js";
import {
  ApiRequestLog,
  ReconciliationCase,
  WebhookEvent,
} from "../developer/developer.model.js";
import { Merchant } from "../merchants/merchant.model.js";
import { Payment } from "../payments/payment.model.js";
import { RiskAlert } from "../risk/risk-alert.model.js";
import { DemoConfig } from "../demo/demo.model.js";

const SUCCESS_STATUSES = new Set([
  PAYMENT_STATUS.CAPTURED,
  PAYMENT_STATUS.REFUNDED,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
]);

const REFUNDABLE_STATUSES = new Set([
  PAYMENT_STATUS.CAPTURED,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
]);

function amountString(value) {
  return value === undefined || value === null ? "0" : value.toString();
}

function merchantDto(merchant) {
  return {
    id: String(merchant._id),
    name: merchant.name,
    slug: merchant.slug,
    currency: merchant.currency,
    status: merchant.status,
    isDemo: Boolean(merchant.isDemo),
  };
}

function paymentDto(payment) {
  return {
    id: String(payment._id),
    merchantId: String(payment.merchantId),
    reference: payment.reference,
    customerReference:
      payment.customerReference ?? payment.customerLabel ?? null,
    customerLabel: payment.customerLabel ?? payment.customerReference ?? null,
    amountMinor: amountString(payment.amountMinor),
    refundedMinor: amountString(payment.refundedMinor),
    currency: payment.currency,
    status: payment.status,
    riskScore: payment.riskScore,
    description: payment.description,
    createdAt: payment.createdAt,
  };
}

function riskAlertDto(alert, merchantById = new Map()) {
  const merchant = merchantById.get(String(alert.merchantId));
  return {
    id: String(alert._id),
    merchantId: String(alert.merchantId),
    merchantName: merchant?.name ?? null,
    paymentId: alert.paymentId ? String(alert.paymentId) : null,
    reference: alert.reference,
    score: alert.score,
    severity: alert.severity,
    status: alert.status,
    ruleCode: alert.ruleCode,
    summary: alert.summary,
    explanation: alert.explanation,
    signals: alert.signals,
    timeline: alert.timeline,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
  };
}

function auditDto(log) {
  return {
    id: String(log._id),
    actorRole: log.actorRole ?? null,
    merchantId: log.merchantId ? String(log.merchantId) : null,
    action: log.action,
    outcome: log.outcome,
    resourceType: log.resourceType ?? null,
    resourceId: log.resourceId ?? null,
    isDemo: Boolean(log.isDemo),
    createdAt: log.createdAt,
  };
}

function webhookDto(event) {
  return {
    id: String(event._id),
    providerEventId: event.providerEventId,
    eventType: event.eventType,
    status: event.status,
    signatureValid: event.signatureValid,
    payloadPreview: event.payloadPreview,
    deliveredAt: event.deliveredAt ?? null,
    createdAt: event.createdAt,
  };
}

function requestLogDto(log) {
  return {
    id: String(log._id),
    method: log.method,
    path: log.path,
    statusCode: log.statusCode,
    latencyMs: log.latencyMs,
    requestId: log.requestId,
    idempotencyResult: log.idempotencyResult ?? null,
    createdAt: log.createdAt,
  };
}

function reconciliationDto(row) {
  return {
    id: String(row._id),
    caseNumber: row.caseNumber,
    reason: row.reason,
    status: row.status,
    expectedMinor: amountString(row.expectedMinor),
    observedMinor: amountString(row.observedMinor),
    currency: row.currency,
    createdAt: row.createdAt,
  };
}

function computeMerchantStats(payments) {
  let volume = 0n;
  let netRevenue = 0n;
  let refunded = 0n;
  let successful = 0;
  let failed = 0;
  let unknown = 0;
  let refundableAmount = 0n;
  let refundableCount = 0;

  for (const payment of payments) {
    const amount = BigInt(amountString(payment.amountMinor));
    const refundedAmount = BigInt(amountString(payment.refundedMinor));

    if (SUCCESS_STATUSES.has(payment.status)) {
      successful += 1;
      volume += amount;
      netRevenue += amount - refundedAmount;
    }
    if (payment.status === PAYMENT_STATUS.FAILED) failed += 1;
    if (payment.status === PAYMENT_STATUS.UNKNOWN) unknown += 1;
    refunded += refundedAmount;

    if (
      REFUNDABLE_STATUSES.has(payment.status) &&
      amount - refundedAmount > 0n
    ) {
      refundableCount += 1;
      refundableAmount += amount - refundedAmount;
    }
  }

  const attempts = payments.length;
  const successRate =
    attempts === 0 ? 0 : Math.round((successful / attempts) * 1000) / 10;

  return {
    attempts,
    successful,
    failed,
    unknown,
    successRate,
    volumeMinor: volume.toString(),
    netRevenueMinor: netRevenue.toString(),
    refundedMinor: refunded.toString(),
    refundableCount,
    refundableAmountMinor: refundableAmount.toString(),
  };
}

function buildDailySeries(payments) {
  const days = new Map();
  const now = new Date();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    days.set(key, { date: key, successful: 0, failed: 0, unknown: 0 });
  }

  for (const payment of payments) {
    const key = new Date(payment.createdAt).toISOString().slice(0, 10);
    const bucket = days.get(key);
    if (!bucket) continue;

    if (SUCCESS_STATUSES.has(payment.status)) bucket.successful += 1;
    else if (payment.status === PAYMENT_STATUS.FAILED) bucket.failed += 1;
    else if (payment.status === PAYMENT_STATUS.UNKNOWN) bucket.unknown += 1;
  }

  return [...days.values()];
}

export async function merchantDashboard(auth) {
  const merchant = await Merchant.findById(auth.merchantId).lean();
  const merchantFilter = {
    merchantId: auth.merchantId,
    ...(auth.isDemo ? { isDemo: true } : {}),
  };

  const [payments, alerts] = await Promise.all([
    Payment.find(merchantFilter).sort({ createdAt: -1 }).limit(100).lean(),
    RiskAlert.find(merchantFilter).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  const stats = computeMerchantStats(payments);
  const merchantById = new Map([[String(merchant._id), merchant]]);

  return {
    merchant: merchantDto(merchant),
    dataMode: "SEEDED_DEMO_PREVIEW",
    analyticsNotice:
      "All figures come from seeded synthetic records. They are not observed production metrics.",
    capabilities: {
      createPayment: "AVAILABLE",
      refunds: "UPCOMING",
      providerExecution: "UPCOMING",
      reconciliation: "UPCOMING",
    },
    stats,
    reliability: {
      authorizationSuccessRate: stats.successRate,
      failedAttempts: stats.failed,
      unknownAttempts: stats.unknown,
      refundableCount: stats.refundableCount,
      dailySeries: buildDailySeries(payments),
    },
    transactions: payments.map(paymentDto),
    failures: payments
      .filter((payment) => payment.status === PAYMENT_STATUS.FAILED)
      .map(paymentDto),
    refundEligible: payments
      .filter(
        (payment) =>
          REFUNDABLE_STATUSES.has(payment.status) &&
          BigInt(amountString(payment.amountMinor)) >
            BigInt(amountString(payment.refundedMinor)),
      )
      .map(paymentDto),
    riskAlerts: alerts.map((alert) => riskAlertDto(alert, merchantById)),
  };
}

export async function adminDashboard(auth, { database } = {}) {
  if (!auth.isDemo) {
    throw new AppError(
      403,
      "DEMO_SCOPE_REQUIRED",
      "Admin dashboard is restricted to the demo sandbox",
    );
  }

  const [merchants, payments, alerts, auditLogs, reconciliation, demoConfig] =
    await Promise.all([
      Merchant.find({ isDemo: true, status: "ACTIVE" })
        .sort({ name: 1 })
        .lean(),
      Payment.find({ isDemo: true }).lean(),
      RiskAlert.find({ isDemo: true }).sort({ score: -1 }).lean(),
      AuditLog.find({ isDemo: true }).sort({ createdAt: -1 }).limit(25).lean(),
      ReconciliationCase.find({ isDemo: true }).sort({ createdAt: -1 }).lean(),
      DemoConfig.find({}).sort({ key: 1 }).lean(),
    ]);

  const merchantById = new Map(
    merchants.map((merchant) => [String(merchant._id), merchant]),
  );

  const merchantRows = merchants.map((merchant) => {
    const scoped = payments.filter(
      (payment) => String(payment.merchantId) === String(merchant._id),
    );
    const stats = computeMerchantStats(scoped);
    return {
      ...merchantDto(merchant),
      paymentCount: scoped.length,
      volumeMinor: stats.volumeMinor,
      successRate: stats.successRate,
      openAlerts: alerts.filter(
        (alert) =>
          String(alert.merchantId) === String(merchant._id) &&
          ["OPEN", "IN_REVIEW", "ESCALATED"].includes(alert.status),
      ).length,
    };
  });

  const openIncidents = alerts.filter((alert) =>
    ["OPEN", "IN_REVIEW", "ESCALATED"].includes(alert.status),
  );

  return {
    scope: "DEMO_SANDBOX_ONLY",
    dataMode: "SEEDED_DEMO_PREVIEW",
    analyticsNotice:
      "Sandbox administration is limited to synthetic demo merchants and records. Real tenants are excluded by server-side scope.",
    database: database
      ? { engine: "mongodb", status: database.status() }
      : { engine: "mongodb", status: "unknown" },
    capabilities: {
      merchantManagement: "READ_ONLY_PREVIEW",
      incidentActions: "UPCOMING",
      reconciliation: "READ_ONLY_PREVIEW",
      demoConfiguration: "READ_ONLY",
    },
    stats: {
      demoMerchants: merchants.length,
      paymentRecords: payments.length,
      openIncidents: openIncidents.length,
      unknownPayments: payments.filter(
        (payment) => payment.status === PAYMENT_STATUS.UNKNOWN,
      ).length,
      auditEvents: auditLogs.length,
      reconciliationCases: reconciliation.length,
    },
    merchants: merchantRows,
    incidents: openIncidents.map((alert) => riskAlertDto(alert, merchantById)),
    auditLogs: auditLogs.map(auditDto),
    reconciliation: reconciliation.map(reconciliationDto),
    demoConfiguration: demoConfig.map((entry) => ({
      key: entry.key,
      value: entry.value,
      description: entry.description ?? null,
    })),
  };
}

export async function developerDashboard(auth) {
  const merchantFilter = {
    merchantId: auth.merchantId,
    ...(auth.isDemo ? { isDemo: true } : {}),
  };

  const [merchant, webhooks, requestLogs] = await Promise.all([
    Merchant.findById(auth.merchantId).lean(),
    WebhookEvent.find(merchantFilter).sort({ createdAt: -1 }).limit(50).lean(),
    ApiRequestLog.find(merchantFilter).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  return {
    merchant: merchantDto(merchant),
    dataMode: "SEEDED_DEMO_PREVIEW",
    capabilities: {
      idempotencyTesting: "UPCOMING",
      providerFaultInjection: "UPCOMING",
      webhookReplay: "READ_ONLY_PREVIEW",
      liveApiKeys: "UPCOMING",
    },
    apiDocsPath: "/api-docs",
    samplePaymentRequest: {
      method: "POST",
      path: "/api/v1/payments",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "demo-idempotency-key-0001",
      },
      body: {
        amountMinor: "129900",
        currency: "USD",
        description: "Synthetic order #1042",
        merchantReference: "demo-order-1042",
      },
      note: "Payment creation is not active in Milestone 02. The example documents the planned contract.",
    },
    providerConfig: {
      mode: "MOCK_PROVIDER",
      baseUrl: "http://127.0.0.1:4100",
      database: "isolated provider MongoDB instance",
      secretsExposed: false,
      signatureVerification: "HMAC-SHA256 (planned for M03)",
    },
    webhookEvents: webhooks.map(webhookDto),
    requestLogs: requestLogs.map(requestLogDto),
    integrationExamples: [
      {
        title: "Create a payment (planned contract)",
        language: "bash",
        code: 'curl -X POST "$PRATYAYA_API/api/v1/payments" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: demo-idempotency-key-0001" \\\n  -d \'{"amountMinor":"129900","currency":"USD"}\'',
      },
      {
        title: "Verify a webhook signature (planned)",
        language: "javascript",
        code: 'const expected = createHmac("sha256", secret)\n  .update(rawBody)\n  .digest("hex");\nassert.equal(timingSafeEqualHex(expected, signature), true);',
      },
    ],
  };
}

export async function riskDashboard(auth) {
  const scope = auth.isDemo
    ? { isDemo: true }
    : { merchantId: auth.merchantId };
  const [alerts, merchants] = await Promise.all([
    RiskAlert.find(scope).sort({ score: -1, createdAt: -1 }).lean(),
    Merchant.find(
      auth.isDemo ? { isDemo: true } : { _id: auth.merchantId },
    ).lean(),
  ]);

  const merchantById = new Map(
    merchants.map((merchant) => [String(merchant._id), merchant]),
  );
  const queue = alerts.filter((alert) =>
    ["OPEN", "IN_REVIEW", "ESCALATED"].includes(alert.status),
  );
  const averageScore =
    alerts.length === 0
      ? 0
      : Math.round(
          alerts.reduce((total, alert) => total + alert.score, 0) /
            alerts.length,
        );

  return {
    scope: auth.isDemo ? "DEMO_SANDBOX_ONLY" : "MERCHANT_SCOPE",
    dataMode: "SEEDED_DEMO_PREVIEW",
    analyticsNotice:
      "Risk scores are deterministic demo rules over synthetic records. No real customer or fraud data is used.",
    capabilities: {
      ruleEngine: "SEEDED_PREVIEW",
      manualReviewActions: "UPCOMING",
      investigationTimeline: "READ_ONLY_PREVIEW",
      incidentAnalysis: "READ_ONLY_PREVIEW",
    },
    stats: {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter((alert) => alert.severity === "CRITICAL")
        .length,
      highAlerts: alerts.filter((alert) => alert.severity === "HIGH").length,
      openReviews: queue.length,
      averageScore,
    },
    alerts: alerts.map((alert) => riskAlertDto(alert, merchantById)),
    reviewQueue: queue.map((alert) => riskAlertDto(alert, merchantById)),
  };
}

export async function listAuditLogs(auth, { limit = 50 } = {}) {
  const canReadAllDemo =
    auth.isDemo && [ROLES.ADMIN, ROLES.AUDITOR].includes(auth.role);
  const filter = canReadAllDemo
    ? { isDemo: true }
    : { merchantId: auth.merchantId, ...(auth.isDemo ? { isDemo: true } : {}) };

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean();

  return {
    scope: canReadAllDemo ? "DEMO_SANDBOX_ONLY" : "MERCHANT_SCOPE",
    logs: logs.map(auditDto),
  };
}

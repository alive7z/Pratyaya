import mongoose from "mongoose";
import { LEDGER_EVENT_TYPES, PAYMENT_STATUS, ROLES } from "@pratyaya/shared";
import { runInTransaction } from "../../lib/transaction.js";
import { User, Session } from "../auth/auth.model.js";
import { Merchant, Membership } from "../merchants/merchant.model.js";
import { AuditLog } from "../audit/audit.model.js";
import { Payment } from "../payments/payment.model.js";
import { PaymentEvent } from "../payments/payment-event.model.js";
import { OutboxEvent } from "../payments/outbox-event.model.js";
import { Journal } from "../ledger/journal.model.js";
import { LedgerAccount } from "../ledger/ledger-account.model.js";
import { LedgerEvent } from "../ledger/ledger-event.model.js";
import { IntegrityReport } from "../ledger/integrity-report.model.js";
import {
  captureEntries,
  ensureChartOfAccounts,
  postJournal,
  refundEntries,
} from "../ledger/ledger.service.js";
import { RiskAlert } from "../risk/risk-alert.model.js";
import { ReconciliationRecord } from "../reconciliation/reconciliation-record.model.js";
import {
  ApiRequestLog,
  ReconciliationCase,
  WebhookEvent,
} from "../developer/developer.model.js";
import { DemoConfig } from "./demo.model.js";

export const DEMO_SEED_VERSION = "m04-2026-10-23-3";

const id = (suffix) =>
  new mongoose.Types.ObjectId(`64b0000000000000000${suffix}`);

export const DEMO_IDS = Object.freeze({
  merchantAdmin: id("00001"),
  merchantNorthwind: id("00002"),
  merchantSummit: id("00003"),
  merchantAurora: id("00004"),
  userAdmin: id("00101"),
  userMerchant: id("00102"),
  userDeveloper: id("00103"),
  userRisk: id("00104"),
  userAuditor: id("00105"),
});

export const DEMO_MERCHANT_SLUGS = Object.freeze({
  ADMIN: "pratyaya-demo-sandbox",
  MERCHANT: "northwind-commerce",
  DEVELOPER: "northwind-commerce",
  RISK_ANALYST: "northwind-commerce",
});

function daysAgo(days, hours = 0) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

function payment({
  suffix,
  merchantId,
  reference,
  customerLabel,
  customerReference,
  amountMinor,
  capturedMinor,
  refundedMinor = 0n,
  currency = "USD",
  status,
  riskScore,
  days,
  hours = 0,
  description,
  metadata,
}) {
  const captureStatuses = [
    PAYMENT_STATUS.CAPTURED,
    PAYMENT_STATUS.REFUND_PENDING,
    PAYMENT_STATUS.PARTIALLY_REFUNDED,
    PAYMENT_STATUS.REFUNDED,
  ];
  return {
    _id: id(suffix),
    merchantId,
    reference,
    customerReference: customerReference ?? customerLabel,
    customerLabel,
    amountMinor: BigInt(amountMinor),
    capturedMinor: BigInt(
      capturedMinor ?? (captureStatuses.includes(status) ? amountMinor : 0n),
    ),
    refundedMinor: BigInt(refundedMinor),
    currency,
    status,
    riskScore,
    description,
    metadata,
    isDemo: true,
    createdAt: daysAgo(days, hours),
    updatedAt: daysAgo(days, hours),
  };
}

function paymentsSeed() {
  return [
    payment({
      suffix: "00201",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1042",
      customerLabel: "Acme Retail",
      amountMinor: "129900",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 12,
      days: 0,
      hours: 2,
      description: "Simulated order checkout",
    }),
    payment({
      suffix: "00202",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1043",
      customerLabel: "Bluebird Foods",
      amountMinor: "79900",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 8,
      days: 1,
      hours: 4,
      description: "Simulated subscription renewal",
    }),
    payment({
      suffix: "00203",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1044",
      customerLabel: "Orbit Supplies",
      amountMinor: "249900",
      status: PAYMENT_STATUS.FAILED,
      riskScore: 78,
      days: 1,
      hours: 8,
      description: "Simulated issuer decline",
    }),
    payment({
      suffix: "00204",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1045",
      customerLabel: "Harbor Books",
      amountMinor: "45900",
      refundedMinor: "45900",
      status: PAYMENT_STATUS.REFUNDED,
      riskScore: 5,
      days: 2,
      hours: 3,
      description: "Simulated refunded order",
    }),
    payment({
      suffix: "00205",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1046",
      customerLabel: "Pine & Co.",
      amountMinor: "185000",
      refundedMinor: "50000",
      status: PAYMENT_STATUS.PARTIALLY_REFUNDED,
      riskScore: 22,
      days: 3,
      hours: 5,
      description: "Simulated partial refund",
    }),
    payment({
      suffix: "00206",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1047",
      customerLabel: "Cedar Works",
      amountMinor: "99000",
      status: PAYMENT_STATUS.AUTHORIZED,
      riskScore: 18,
      days: 3,
      hours: 9,
      description: "Awaiting simulated capture",
    }),
    payment({
      suffix: "00207",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1048",
      customerLabel: "Nimbus Travel",
      amountMinor: "64000",
      status: PAYMENT_STATUS.UNKNOWN,
      riskScore: 55,
      days: 4,
      hours: 1,
      description: "Provider response timed out",
    }),
    payment({
      suffix: "00208",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1049",
      customerLabel: "Atlas Market",
      amountMinor: "320500",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 16,
      days: 5,
      hours: 2,
      description: "Simulated wholesale order",
    }),
    payment({
      suffix: "00209",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1050",
      customerLabel: "Rapid Kiosk",
      amountMinor: "125000",
      status: PAYMENT_STATUS.FAILED,
      riskScore: 84,
      days: 6,
      hours: 6,
      description: "Simulated velocity block",
    }),
    payment({
      suffix: "00210",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-1051",
      customerLabel: "Tiny Pine",
      amountMinor: "15000",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 3,
      days: 7,
      hours: 3,
      description: "Simulated low-value checkout",
    }),
    payment({
      suffix: "00222",
      merchantId: DEMO_IDS.merchantNorthwind,
      reference: "NW-INR-1052",
      customerLabel: "Lotus Market",
      amountMinor: "125000",
      refundedMinor: "25000",
      currency: "INR",
      status: PAYMENT_STATUS.PARTIALLY_REFUNDED,
      riskScore: 10,
      days: 1,
      hours: 6,
      description: "Simulated INR order with partial refund",
    }),
    payment({
      suffix: "00211",
      merchantId: DEMO_IDS.merchantSummit,
      reference: "SE-2201",
      customerLabel: "Pioneer Audio",
      amountMinor: "450000",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 14,
      days: 1,
      hours: 2,
      description: "Simulated hardware order",
    }),
    payment({
      suffix: "00212",
      merchantId: DEMO_IDS.merchantSummit,
      reference: "SE-2202",
      customerLabel: "Unknown Device Co.",
      amountMinor: "89900",
      status: PAYMENT_STATUS.FAILED,
      riskScore: 66,
      days: 2,
      hours: 7,
      description: "Simulated card testing block",
    }),
    payment({
      suffix: "00213",
      merchantId: DEMO_IDS.merchantSummit,
      reference: "SE-2203",
      customerLabel: "Vertex Labs",
      amountMinor: "219900",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 9,
      days: 4,
      hours: 2,
      description: "Simulated enterprise order",
    }),
    payment({
      suffix: "00214",
      merchantId: DEMO_IDS.merchantSummit,
      reference: "SE-2204",
      customerLabel: "Fable Studio",
      amountMinor: "32900",
      refundedMinor: "32900",
      status: PAYMENT_STATUS.REFUNDED,
      riskScore: 4,
      days: 8,
      hours: 1,
      description: "Simulated returned accessory",
    }),
    payment({
      suffix: "00215",
      merchantId: DEMO_IDS.merchantSummit,
      reference: "SE-2205",
      customerLabel: "Kite Robotics",
      amountMinor: "500000",
      refundedMinor: "100000",
      status: PAYMENT_STATUS.PARTIALLY_REFUNDED,
      riskScore: 21,
      days: 9,
      hours: 5,
      description: "Simulated partial cancellation",
    }),
    payment({
      suffix: "00216",
      merchantId: DEMO_IDS.merchantSummit,
      reference: "SE-2206",
      customerLabel: "Juniper Design",
      amountMinor: "129900",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 11,
      days: 11,
      hours: 4,
      description: "Simulated monitor order",
    }),
    payment({
      suffix: "00217",
      merchantId: DEMO_IDS.merchantAurora,
      reference: "AT-3301",
      customerLabel: "Summit Group",
      amountMinor: "780000",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 13,
      days: 0,
      hours: 5,
      description: "Simulated group booking",
    }),
    payment({
      suffix: "00218",
      merchantId: DEMO_IDS.merchantAurora,
      reference: "AT-3302",
      customerLabel: "Fast Pass Resale",
      amountMinor: "120000",
      status: PAYMENT_STATUS.FAILED,
      riskScore: 91,
      days: 2,
      hours: 1,
      description: "Simulated watchlist rejection",
    }),
    payment({
      suffix: "00219",
      merchantId: DEMO_IDS.merchantAurora,
      reference: "AT-3303",
      customerLabel: "Solo Traveller",
      amountMinor: "96000",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 7,
      days: 3,
      hours: 2,
      description: "Simulated seat reservation",
    }),
    payment({
      suffix: "00220",
      merchantId: DEMO_IDS.merchantAurora,
      reference: "AT-3304",
      customerLabel: "Last Minute Deals",
      amountMinor: "410000",
      status: PAYMENT_STATUS.UNKNOWN,
      riskScore: 62,
      days: 5,
      hours: 6,
      description: "Simulated provider timeout",
    }),
    payment({
      suffix: "00221",
      merchantId: DEMO_IDS.merchantAurora,
      reference: "AT-3305",
      customerLabel: "Blue Horizon",
      amountMinor: "275000",
      status: PAYMENT_STATUS.CAPTURED,
      riskScore: 19,
      days: 10,
      hours: 3,
      description: "Simulated itinerary payment",
    }),
  ];
}

function riskAlertsSeed() {
  return [
    {
      _id: id("00301"),
      merchantId: DEMO_IDS.merchantNorthwind,
      paymentId: id("00209"),
      reference: "NW-1050",
      score: 84,
      severity: "HIGH",
      status: "OPEN",
      ruleCode: "VELOCITY_10M",
      summary:
        "Five simulated attempts from one synthetic customer in ten minutes",
      explanation:
        "The synthetic payment pattern exceeded the demo velocity rule. No real customer data is involved; this is a read-only sandbox example.",
      signals: ["velocity", "amount_deviation", "review_required"],
      timeline: [
        {
          at: daysAgo(6, 6),
          label: "Rule triggered",
          detail: "Velocity threshold crossed in the synthetic dataset.",
        },
        {
          at: daysAgo(6, 5),
          label: "Payment rejected",
          detail: "Simulated issuer declined the operation.",
        },
        {
          at: daysAgo(6, 4),
          label: "Queued for review",
          detail: "Manual review is read-only until the risk workflow ships.",
        },
      ],
      isDemo: true,
      createdAt: daysAgo(6, 6),
      updatedAt: daysAgo(6, 4),
    },
    {
      _id: id("00302"),
      merchantId: DEMO_IDS.merchantNorthwind,
      paymentId: id("00203"),
      reference: "NW-1044",
      score: 78,
      severity: "HIGH",
      status: "IN_REVIEW",
      ruleCode: "BILLING_MISMATCH",
      summary:
        "Synthetic billing country differs from simulated shipping region",
      explanation:
        "A demo-only rule compared synthetic attributes. The alert is illustrative and has no external fraud data source.",
      signals: ["geo_mismatch", "new_customer"],
      timeline: [
        {
          at: daysAgo(1, 8),
          label: "Alert created",
          detail: "Synthetic billing and shipping regions differed.",
        },
        {
          at: daysAgo(1, 7),
          label: "Review opened",
          detail: "Demo analyst opened a read-only review.",
        },
      ],
      isDemo: true,
      createdAt: daysAgo(1, 8),
      updatedAt: daysAgo(1, 7),
    },
    {
      _id: id("00303"),
      merchantId: DEMO_IDS.merchantNorthwind,
      paymentId: id("00207"),
      reference: "NW-1048",
      score: 55,
      severity: "MEDIUM",
      status: "OPEN",
      ruleCode: "PROVIDER_UNKNOWN",
      summary: "Provider response is unknown and requires reconciliation",
      explanation:
        "UNKNOWN is treated as unresolved rather than failed. Reconciliation automation is planned for Milestone 04.",
      signals: ["provider_timeout", "unknown_state"],
      timeline: [
        {
          at: daysAgo(4, 1),
          label: "Provider timeout recorded",
          detail:
            "The synthetic provider did not answer within the demo window.",
        },
      ],
      isDemo: true,
      createdAt: daysAgo(4, 1),
      updatedAt: daysAgo(4, 1),
    },
    {
      _id: id("00304"),
      merchantId: DEMO_IDS.merchantSummit,
      paymentId: id("00212"),
      reference: "SE-2202",
      score: 66,
      severity: "HIGH",
      status: "CLEARED",
      ruleCode: "CARD_TESTING_PATTERN",
      summary: "Synthetic device reuse across declined demo attempts",
      explanation:
        "The demo rule flags repeated synthetic device identifiers. The seeded case was cleared manually for illustration.",
      signals: ["device_reuse", "multiple_declines"],
      timeline: [
        {
          at: daysAgo(2, 7),
          label: "Alert created",
          detail: "Three synthetic declines shared a demo device label.",
        },
        {
          at: daysAgo(2, 5),
          label: "Case cleared",
          detail: "Demo analyst marked the example as expected test traffic.",
        },
      ],
      isDemo: true,
      createdAt: daysAgo(2, 7),
      updatedAt: daysAgo(2, 5),
    },
    {
      _id: id("00305"),
      merchantId: DEMO_IDS.merchantAurora,
      paymentId: id("00218"),
      reference: "AT-3302",
      score: 91,
      severity: "CRITICAL",
      status: "ESCALATED",
      ruleCode: "WATCHLIST_DEMO_MATCH",
      summary: "Synthetic watchlist token matched a demo deny rule",
      explanation:
        "This is a synthetic rule match only. Pratyaya never ingests real watchlists or personal payment data.",
      signals: ["watchlist_demo", "high_value"],
      timeline: [
        {
          at: daysAgo(2, 1),
          label: "Rule triggered",
          detail: "Demo watchlist token matched a local deny rule.",
        },
        {
          at: daysAgo(2, 0),
          label: "Escalated",
          detail: "The synthetic case is escalated for demonstration.",
        },
      ],
      isDemo: true,
      createdAt: daysAgo(2, 1),
      updatedAt: daysAgo(2, 0),
    },
    {
      _id: id("00306"),
      merchantId: DEMO_IDS.merchantAurora,
      paymentId: id("00220"),
      reference: "AT-3304",
      score: 62,
      severity: "MEDIUM",
      status: "OPEN",
      ruleCode: "PROVIDER_UNKNOWN",
      summary: "Synthetic booking amount remains in an unknown provider state",
      explanation:
        "The demo dashboard displays the unresolved state honestly; no success or failure is inferred.",
      signals: ["provider_timeout", "high_amount"],
      timeline: [
        {
          at: daysAgo(5, 6),
          label: "Unknown state persisted",
          detail: "Reconciliation will reuse the same provider operation ID.",
        },
      ],
      isDemo: true,
      createdAt: daysAgo(5, 6),
      updatedAt: daysAgo(5, 6),
    },
  ];
}

function webhookEventsSeed() {
  const events = [
    [
      "00401",
      DEMO_IDS.merchantNorthwind,
      "evt_demo_1042",
      "payment.captured",
      "DELIVERED",
      true,
      0,
    ],
    [
      "00402",
      DEMO_IDS.merchantNorthwind,
      "evt_demo_1044",
      "payment.failed",
      "DELIVERED",
      true,
      1,
    ],
    [
      "00403",
      DEMO_IDS.merchantNorthwind,
      "evt_demo_1045",
      "payment.refunded",
      "DELIVERED",
      true,
      2,
    ],
    [
      "00404",
      DEMO_IDS.merchantNorthwind,
      "evt_demo_1048",
      "payment.unknown",
      "RETRYING",
      true,
      4,
    ],
    [
      "00405",
      DEMO_IDS.merchantSummit,
      "evt_demo_2201",
      "payment.captured",
      "DELIVERED",
      true,
      1,
    ],
    [
      "00406",
      DEMO_IDS.merchantSummit,
      "evt_demo_2202",
      "payment.failed",
      "FAILED",
      false,
      2,
    ],
    [
      "00407",
      DEMO_IDS.merchantAurora,
      "evt_demo_3301",
      "payment.captured",
      "DELIVERED",
      true,
      0,
    ],
    [
      "00408",
      DEMO_IDS.merchantAurora,
      "evt_demo_3304",
      "payment.unknown",
      "RECEIVED",
      true,
      5,
    ],
  ];

  return events.map(
    ([
      suffix,
      merchantId,
      providerEventId,
      eventType,
      status,
      signatureValid,
      days,
    ]) => ({
      _id: id(suffix),
      merchantId,
      providerEventId,
      eventType,
      status,
      signatureValid,
      payloadPreview: {
        id: providerEventId,
        type: eventType,
        simulation: true,
      },
      deliveredAt: status === "DELIVERED" ? daysAgo(days, 1) : undefined,
      isDemo: true,
      createdAt: daysAgo(days, 2),
      updatedAt: daysAgo(days, 1),
    }),
  );
}

function apiRequestLogsSeed() {
  const rows = [
    [
      "00501",
      DEMO_IDS.merchantNorthwind,
      "POST",
      "/v1/payments",
      201,
      182,
      "NEW",
      0,
    ],
    [
      "00502",
      DEMO_IDS.merchantNorthwind,
      "POST",
      "/v1/payments",
      200,
      9,
      "REPLAYED",
      0,
    ],
    [
      "00503",
      DEMO_IDS.merchantNorthwind,
      "GET",
      "/v1/payments",
      200,
      41,
      undefined,
      1,
    ],
    [
      "00504",
      DEMO_IDS.merchantNorthwind,
      "POST",
      "/v1/refunds",
      409,
      33,
      "CONFLICT",
      1,
    ],
    [
      "00505",
      DEMO_IDS.merchantNorthwind,
      "GET",
      "/v1/payments/NW-1048",
      200,
      28,
      undefined,
      4,
    ],
    [
      "00506",
      DEMO_IDS.merchantSummit,
      "POST",
      "/v1/payments",
      201,
      210,
      "NEW",
      1,
    ],
    [
      "00507",
      DEMO_IDS.merchantSummit,
      "GET",
      "/v1/payments",
      200,
      52,
      undefined,
      2,
    ],
    [
      "00508",
      DEMO_IDS.merchantAurora,
      "POST",
      "/v1/payments",
      201,
      164,
      "NEW",
      0,
    ],
    [
      "00509",
      DEMO_IDS.merchantAurora,
      "GET",
      "/v1/payments/AT-3304",
      200,
      31,
      undefined,
      5,
    ],
    [
      "00510",
      DEMO_IDS.merchantNorthwind,
      "GET",
      "/v1/health/ready",
      200,
      7,
      undefined,
      0,
    ],
  ];

  return rows.map(
    ([
      suffix,
      merchantId,
      method,
      path,
      statusCode,
      latencyMs,
      idempotencyResult,
      days,
    ]) => ({
      _id: id(suffix),
      merchantId,
      method,
      path,
      statusCode,
      latencyMs,
      requestId: `demo-req-${suffix.slice(-3)}`,
      idempotencyResult,
      isDemo: true,
      createdAt: daysAgo(days, 1),
      updatedAt: daysAgo(days, 1),
    }),
  );
}

function auditSeed() {
  const rows = [
    ["00601", DEMO_IDS.merchantNorthwind, "demo.dataset.seeded", "demo"],
    ["00602", DEMO_IDS.merchantNorthwind, "payment.preview.viewed", "payment"],
    ["00603", DEMO_IDS.merchantSummit, "payment.preview.viewed", "payment"],
    ["00604", DEMO_IDS.merchantAurora, "risk.alert.reviewed", "risk_alert"],
    ["00605", DEMO_IDS.merchantAdmin, "demo.sandbox.inspected", "demo"],
    [
      "00606",
      DEMO_IDS.merchantNorthwind,
      "auth.demo.session.created",
      "session",
    ],
  ];

  return rows.map(([suffix, merchantId, action, resourceType], index) => ({
    _id: id(suffix),
    actorRole: index % 2 === 0 ? ROLES.MERCHANT : ROLES.RISK_ANALYST,
    merchantId,
    action,
    outcome: "SUCCESS",
    resourceType,
    metadata: { seeded: true },
    isDemo: true,
    createdAt: daysAgo(index, 2),
  }));
}

function reconciliationSeed() {
  return [
    {
      _id: id("00701"),
      merchantId: DEMO_IDS.merchantNorthwind,
      paymentId: id("00207"),
      caseNumber: "REC-DEMO-1001",
      reason: "Provider response timeout requires a safe lookup",
      status: "OPEN",
      expectedMinor: 64000n,
      observedMinor: 64000n,
      currency: "USD",
      isDemo: true,
      createdAt: daysAgo(4, 1),
      updatedAt: daysAgo(4, 1),
    },
    {
      _id: id("00702"),
      merchantId: DEMO_IDS.merchantAurora,
      paymentId: id("00220"),
      caseNumber: "REC-DEMO-1002",
      reason: "Unknown booking state pending simulated provider lookup",
      status: "IN_PROGRESS",
      expectedMinor: 410000n,
      observedMinor: 410000n,
      currency: "USD",
      isDemo: true,
      createdAt: daysAgo(5, 6),
      updatedAt: daysAgo(5, 4),
    },
    {
      _id: id("00703"),
      merchantId: DEMO_IDS.merchantSummit,
      paymentId: id("00215"),
      caseNumber: "REC-DEMO-1003",
      reason: "Partial refund example kept for future reconciliation UI",
      status: "RESOLVED",
      expectedMinor: 100000n,
      observedMinor: 100000n,
      currency: "USD",
      isDemo: true,
      createdAt: daysAgo(9, 5),
      updatedAt: daysAgo(9, 2),
    },
  ];
}

function ledgerReconciliationSeed() {
  return reconciliationSeed().map((record) => ({
    merchantId: record.merchantId,
    paymentId: record.paymentId,
    providerReference: `synthetic-provider-${record.caseNumber}`,
    internalPaymentStatus:
      record.status === "RESOLVED" ? PAYMENT_STATUS.REFUNDED : "UNKNOWN",
    externalProviderStatus:
      record.status === "RESOLVED" ? "REFUNDED" : "LOOKUP_PENDING",
    expectedAmountMinor: record.expectedMinor,
    observedAmountMinor: record.observedMinor,
    currency: record.currency,
    status:
      record.status === "RESOLVED"
        ? "RESOLVED"
        : record.status === "IN_PROGRESS"
          ? "STATUS_MISMATCH"
          : "PENDING_REVIEW",
    attemptCount: record.status === "OPEN" ? 0 : 1,
    lastCheckedAt: record.updatedAt,
    resolutionMetadata: {
      reason: record.reason,
      caseNumber: record.caseNumber,
      syntheticFixture: true,
    },
    isSyntheticFixture: true,
    isDemo: true,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

async function seedLedgerFixtures() {
  const financialStatuses = [
    PAYMENT_STATUS.CAPTURED,
    PAYMENT_STATUS.REFUND_PENDING,
    PAYMENT_STATUS.PARTIALLY_REFUNDED,
    PAYMENT_STATUS.REFUNDED,
  ];
  const payments = await Payment.find({
    isDemo: true,
    status: { $in: financialStatuses },
  });

  for (const payment of payments) {
    await runInTransaction(async (session) => {
      const accounts = await ensureChartOfAccounts({
        merchantId: payment.merchantId,
        currency: payment.currency,
        session,
        isDemo: true,
      });
      const capture = await postJournal({
        merchantId: payment.merchantId,
        sourceType: "DEMO_TRUSTED_CAPTURE",
        sourceId: `capture-${payment.reference}`,
        paymentId: payment._id,
        eventType: LEDGER_EVENT_TYPES.CAPTURE,
        currency: payment.currency,
        entries: captureEntries(accounts, payment.amountMinor),
        session,
        description: `Synthetic confirmed capture for ${payment.reference}`,
        createdBy: "demo-seed",
        metadata: { paymentId: String(payment._id), syntheticFixture: true },
        isDemo: true,
      });

      if (payment.refundedMinor > 0n) {
        await postJournal({
          merchantId: payment.merchantId,
          sourceType: "DEMO_TRUSTED_REFUND",
          sourceId: `refund-${payment.reference}`,
          paymentId: payment._id,
          eventType: LEDGER_EVENT_TYPES.REFUND,
          currency: payment.currency,
          entries: refundEntries(accounts, payment.refundedMinor),
          session,
          description: `Synthetic confirmed refund for ${payment.reference}`,
          createdBy: "demo-seed",
          metadata: {
            paymentId: String(payment._id),
            amountMinor: payment.refundedMinor.toString(),
            syntheticFixture: true,
          },
          reversalOfJournalId: capture.journal.id,
          isDemo: true,
        });
      }
    });
  }
}

const demoCollections = [
  AuditLog,
  ApiRequestLog,
  WebhookEvent,
  ReconciliationCase,
  ReconciliationRecord,
  RiskAlert,
  LedgerAccount,
  IntegrityReport,
  PaymentEvent,
  Payment,
  Session,
  Membership,
  User,
  Merchant,
];

let seedInFlight = null;

export async function runDemoSeed({ force = false, logger } = {}) {
  if (!force) {
    const existing = await DemoConfig.findOne({
      key: "demo.dataset.version",
    }).lean();
    if (existing?.value === DEMO_SEED_VERSION) {
      return { seeded: false, version: DEMO_SEED_VERSION };
    }
  }

  await Promise.all(
    demoCollections.map((model) => model.deleteMany({ isDemo: true })),
  );

  const demoMerchantIds = [
    DEMO_IDS.merchantAdmin,
    DEMO_IDS.merchantNorthwind,
    DEMO_IDS.merchantSummit,
    DEMO_IDS.merchantAurora,
  ];
  await Promise.all([
    Journal.collection.deleteMany({
      merchantId: { $in: demoMerchantIds },
    }),
    LedgerEvent.collection.deleteMany({
      merchantId: { $in: demoMerchantIds },
    }),
    OutboxEvent.collection.deleteMany({
      merchantId: { $in: demoMerchantIds },
    }),
    LedgerAccount.collection.deleteMany({
      merchantId: { $in: demoMerchantIds },
    }),
    ReconciliationRecord.collection.deleteMany({
      merchantId: { $in: demoMerchantIds },
    }),
  ]);

  const now = new Date();

  await Merchant.insertMany([
    {
      _id: DEMO_IDS.merchantAdmin,
      name: "Pratyaya Sandbox Control",
      slug: DEMO_MERCHANT_SLUGS.ADMIN,
      status: "ACTIVE",
      currency: "USD",
      isDemo: true,
      demoAnchorRole: ROLES.ADMIN,
      createdAt: daysAgo(30),
      updatedAt: now,
    },
    {
      _id: DEMO_IDS.merchantNorthwind,
      name: "Northwind Commerce",
      slug: DEMO_MERCHANT_SLUGS.MERCHANT,
      status: "ACTIVE",
      currency: "USD",
      isDemo: true,
      demoAnchorRole: ROLES.MERCHANT,
      createdAt: daysAgo(30),
      updatedAt: now,
    },
    {
      _id: DEMO_IDS.merchantSummit,
      name: "Summit Electronics",
      slug: "summit-electronics",
      status: "ACTIVE",
      currency: "USD",
      isDemo: true,
      createdAt: daysAgo(25),
      updatedAt: now,
    },
    {
      _id: DEMO_IDS.merchantAurora,
      name: "Aurora Travel",
      slug: "aurora-travel",
      status: "ACTIVE",
      currency: "USD",
      isDemo: true,
      createdAt: daysAgo(20),
      updatedAt: now,
    },
  ]);

  await User.insertMany([
    {
      _id: DEMO_IDS.userAdmin,
      email: "admin.persona@sandbox.pratyaya.invalid",
      displayName: "Demo Sandbox Admin",
      status: "ACTIVE",
      isDemo: true,
      isCredentialless: true,
      demoRole: ROLES.ADMIN,
      createdAt: daysAgo(30),
      updatedAt: now,
    },
    {
      _id: DEMO_IDS.userMerchant,
      email: "merchant.persona@sandbox.pratyaya.invalid",
      displayName: "Northwind Demo Merchant",
      status: "ACTIVE",
      isDemo: true,
      isCredentialless: true,
      demoRole: ROLES.MERCHANT,
      createdAt: daysAgo(30),
      updatedAt: now,
    },
    {
      _id: DEMO_IDS.userDeveloper,
      email: "developer.persona@sandbox.pratyaya.invalid",
      displayName: "Northwind Demo Developer",
      status: "ACTIVE",
      isDemo: true,
      isCredentialless: true,
      demoRole: ROLES.DEVELOPER,
      createdAt: daysAgo(30),
      updatedAt: now,
    },
    {
      _id: DEMO_IDS.userRisk,
      email: "risk.persona@sandbox.pratyaya.invalid",
      displayName: "Demo Risk Analyst",
      status: "ACTIVE",
      isDemo: true,
      isCredentialless: true,
      demoRole: ROLES.RISK_ANALYST,
      createdAt: daysAgo(30),
      updatedAt: now,
    },
    {
      _id: DEMO_IDS.userAuditor,
      email: "auditor.persona@sandbox.pratyaya.invalid",
      displayName: "Demo Auditor",
      status: "ACTIVE",
      isDemo: true,
      isCredentialless: true,
      demoRole: ROLES.AUDITOR,
      createdAt: daysAgo(30),
      updatedAt: now,
    },
  ]);

  await Membership.insertMany([
    {
      userId: DEMO_IDS.userAdmin,
      merchantId: DEMO_IDS.merchantAdmin,
      role: ROLES.ADMIN,
      status: "ACTIVE",
      isDemo: true,
    },
    {
      userId: DEMO_IDS.userMerchant,
      merchantId: DEMO_IDS.merchantNorthwind,
      role: ROLES.MERCHANT,
      status: "ACTIVE",
      isDemo: true,
    },
    {
      userId: DEMO_IDS.userDeveloper,
      merchantId: DEMO_IDS.merchantNorthwind,
      role: ROLES.DEVELOPER,
      status: "ACTIVE",
      isDemo: true,
    },
    {
      userId: DEMO_IDS.userRisk,
      merchantId: DEMO_IDS.merchantNorthwind,
      role: ROLES.RISK_ANALYST,
      status: "ACTIVE",
      isDemo: true,
    },
    {
      userId: DEMO_IDS.userAuditor,
      merchantId: DEMO_IDS.merchantAdmin,
      role: ROLES.AUDITOR,
      status: "ACTIVE",
      isDemo: true,
    },
  ]);

  await Payment.insertMany(paymentsSeed());
  await seedLedgerFixtures();
  await RiskAlert.insertMany(riskAlertsSeed());
  await WebhookEvent.insertMany(webhookEventsSeed());
  await ApiRequestLog.insertMany(apiRequestLogsSeed());
  await AuditLog.insertMany(auditSeed());
  await ReconciliationCase.insertMany(reconciliationSeed());
  await ReconciliationRecord.insertMany(ledgerReconciliationSeed());

  await DemoConfig.findOneAndUpdate(
    { key: "demo.dataset.version" },
    {
      $set: {
        key: "demo.dataset.version",
        value: DEMO_SEED_VERSION,
        description: "Version marker for the synthetic demo dataset",
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  await DemoConfig.findOneAndUpdate(
    { key: "demo.mode" },
    {
      $set: {
        key: "demo.mode",
        value: "READ_ONLY_SANDBOX",
        description:
          "Demo dashboards read seeded synthetic data and never mutate financial records",
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  logger?.info?.(
    { event: "demo.seed.completed", version: DEMO_SEED_VERSION },
    "Demo sandbox dataset seeded",
  );

  return { seeded: true, version: DEMO_SEED_VERSION };
}

export async function ensureDemoDataset({ config, logger } = {}) {
  if (!config?.demo?.autoSeed) {
    return { seeded: false, version: DEMO_SEED_VERSION };
  }

  if (seedInFlight) return seedInFlight;

  seedInFlight = runDemoSeed({ logger })
    .catch((error) => {
      logger?.error?.(
        { event: "demo.seed.failed", err: error },
        "Demo sandbox seeding failed",
      );
      throw error;
    })
    .finally(() => {
      seedInFlight = null;
    });

  return seedInFlight;
}

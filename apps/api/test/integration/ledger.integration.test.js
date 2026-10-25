import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LEDGER_EVENT_TYPES,
  OPERATION_STATES,
  OUTBOX_EVENT_TYPES,
  PAYMENT_STATUS,
} from "@pratyaya/shared";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config/env.js";
import { connectMongo, disconnectMongo } from "../../src/db/mongoose.js";
import { runInTransaction } from "../../src/lib/transaction.js";
import { IntegrityReport } from "../../src/modules/ledger/integrity-report.model.js";
import { executeIntegrityCheck } from "../../src/modules/ledger/integrity.service.js";
import { Journal } from "../../src/modules/ledger/journal.model.js";
import { LedgerAccount } from "../../src/modules/ledger/ledger-account.model.js";
import { LedgerEvent } from "../../src/modules/ledger/ledger-event.model.js";
import {
  captureEntries,
  ensureChartOfAccounts,
  postJournal,
} from "../../src/modules/ledger/ledger.service.js";
import {
  confirmTrustedCapture,
  confirmTrustedRefund,
} from "../../src/modules/ledger/payment-ledger.service.js";
import { runDemoSeed } from "../../src/modules/demo/demo.seed.js";
import { OutboxEvent } from "../../src/modules/payments/outbox-event.model.js";
import { PaymentEvent } from "../../src/modules/payments/payment-event.model.js";
import { Payment } from "../../src/modules/payments/payment.model.js";
import { ProviderOperation } from "../../src/modules/payments/operations/provider-operation.model.js";
import { createPaymentOrchestratorService } from "../../src/modules/payments/operations/payment-orchestrator.service.js";
import { IdempotencyRecord } from "../../src/modules/payments/idempotency-record.model.js";
import { createPayment } from "../../src/modules/payments/payment.service.js";
import { Refund } from "../../src/modules/payments/refund.model.js";
import { createRefundService } from "../../src/modules/payments/refund.service.js";
import { RiskDecision } from "../../src/modules/risk/risk-decision.model.js";
import {
  clearProviderFaults,
  setProviderFaults,
} from "../../src/modules/sandbox/sandbox.service.js";

const enabled = process.env.RUN_INTEGRATION_TESTS === "1";
const logger = { info() {}, warn() {}, error() {} };

describe.skipIf(!enabled)("MongoDB ledger transactions", () => {
  const merchantId = new mongoose.Types.ObjectId();
  const otherMerchantId = new mongoose.Types.ObjectId();
  let app;
  let config;
  let accounts;

  beforeAll(async () => {
    config = loadConfig();
    await connectMongo(config.mongodb, logger);
    await Promise.all([
      LedgerAccount.init(),
      Journal.init(),
      LedgerEvent.init(),
      OutboxEvent.init(),
      Payment.init(),
    ]);
    await runDemoSeed({ force: true });
    app = createApp({
      database: {
        ping: async () => true,
        status: () => ({ status: "up" }),
      },
      config,
      logger,
    });
    accounts = await runInTransaction((session) =>
      ensureChartOfAccounts({ merchantId, currency: "INR", session }),
    );
  }, 60_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    const filter = { merchantId: { $in: [merchantId, otherMerchantId] } };
    await Promise.all([
      Journal.collection.deleteMany(filter),
      LedgerAccount.collection.deleteMany(filter),
      LedgerEvent.collection.deleteMany(filter),
      OutboxEvent.collection.deleteMany(filter),
      PaymentEvent.collection.deleteMany(filter),
      IntegrityReport.collection.deleteMany(filter),
      Payment.collection.deleteMany(filter),
      RiskDecision.collection.deleteMany(filter),
      IdempotencyRecord.collection.deleteMany(filter),
      Refund.collection.deleteMany(filter),
      ProviderOperation.collection.deleteMany(filter),
    ]);
    await disconnectMongo();
  });

  async function post(sourceId, options = {}) {
    return runInTransaction((session) =>
      postJournal({
        merchantId,
        sourceType: "TEST_EVENT",
        sourceId,
        eventType: LEDGER_EVENT_TYPES.CAPTURE,
        currency: "INR",
        entries: captureEntries(accounts, options.amountMinor ?? 100000n),
        session,
        description: "Integration fixture",
        createdBy: "integration-test",
        metadata: { syntheticFixture: true },
        injectFailure: options.injectFailure,
      }),
    );
  }

  it("posts a balanced journal, ledger event, and outbox atomically", async () => {
    const result = await post("balanced-post");
    expect(result.journal.entries).toHaveLength(2);
    expect(result.journal.entries[0].amountMinor).toBe("100000");
    expect(
      await LedgerEvent.countDocuments({
        merchantId,
        journalReference: result.journal.journalReference,
      }),
    ).toBe(1);
    expect(
      await OutboxEvent.countDocuments({
        merchantId,
        aggregateId: result.journal.id,
      }),
    ).toBe(1);
  });

  it("rejects missing, wrong-currency, and cross-merchant accounts", async () => {
    const missing = new mongoose.Types.ObjectId();
    await expect(
      runInTransaction((session) =>
        postJournal({
          merchantId,
          sourceType: "TEST_EVENT",
          sourceId: "missing-account",
          eventType: LEDGER_EVENT_TYPES.CAPTURE,
          currency: "INR",
          entries: [
            { accountId: missing, direction: "DEBIT", amountMinor: "10" },
            {
              accountId: accounts.MERCHANT_PAYABLE._id,
              direction: "CREDIT",
              amountMinor: "10",
            },
          ],
          session,
          createdBy: "integration-test",
        }),
      ),
    ).rejects.toMatchObject({ code: "LEDGER_ACCOUNT_NOT_FOUND" });

    const usdAccounts = await runInTransaction((session) =>
      ensureChartOfAccounts({ merchantId, currency: "USD", session }),
    );
    await expect(
      runInTransaction((session) =>
        postJournal({
          merchantId,
          sourceType: "TEST_EVENT",
          sourceId: "wrong-currency",
          eventType: LEDGER_EVENT_TYPES.CAPTURE,
          currency: "INR",
          entries: captureEntries(usdAccounts, 10n),
          session,
          createdBy: "integration-test",
        }),
      ),
    ).rejects.toMatchObject({ code: "LEDGER_ACCOUNT_NOT_FOUND" });

    const foreignAccounts = await runInTransaction((session) =>
      ensureChartOfAccounts({
        merchantId: otherMerchantId,
        currency: "INR",
        session,
      }),
    );
    await expect(
      runInTransaction((session) =>
        postJournal({
          merchantId,
          sourceType: "TEST_EVENT",
          sourceId: "cross-merchant",
          eventType: LEDGER_EVENT_TYPES.CAPTURE,
          currency: "INR",
          entries: captureEntries(foreignAccounts, 10n),
          session,
          createdBy: "integration-test",
        }),
      ),
    ).rejects.toMatchObject({ code: "LEDGER_ACCOUNT_NOT_FOUND" });
  });

  it("rolls back all financial effects after an injected failure", async () => {
    await expect(
      post("rollback-post", { injectFailure: true }),
    ).rejects.toThrow("Injected");
    expect(
      await Journal.countDocuments({ merchantId, sourceId: "rollback-post" }),
    ).toBe(0);
    expect(
      await LedgerEvent.countDocuments({
        merchantId,
        "metadata.sourceId": "rollback-post",
      }),
    ).toBe(0);
  });

  it("rolls back the risk decision with payment creation in the same session", async () => {
    const reference = `RISK-ROLLBACK-${Date.now()}`;
    const idempotencyKey = `risk-rollback-${Date.now()}`;

    await expect(
      createPayment({
        auth: {
          merchantId,
          role: "MERCHANT",
          userId: new mongoose.Types.ObjectId(),
          isDemo: true,
        },
        body: {
          amountMinor: "2500",
          currency: "INR",
          merchantReference: reference,
          customerReference: "Risk rollback fixture",
        },
        req: {
          get(name) {
            return name.toLowerCase() === "idempotency-key"
              ? idempotencyKey
              : undefined;
          },
        },
        injectFailureAfterRisk: true,
      }),
    ).rejects.toThrow("Injected failure after risk decision");

    expect(await Payment.countDocuments({ merchantId, reference })).toBe(0);
    expect(await RiskDecision.countDocuments({ merchantId })).toBe(0);
  });

  it("durably attaches the demo merchant fault to the created payment", async () => {
    const auth = {
      merchantId,
      role: "MERCHANT",
      userId: new mongoose.Types.ObjectId(),
      isDemo: true,
    };
    await setProviderFaults({
      auth,
      config,
      body: {
        enabled: true,
        rules: [{ type: "timeout", enabled: true, delayMs: 25 }],
      },
    });

    try {
      const result = await createPayment({
        auth,
        body: {
          amountMinor: "50000",
          currency: "USD",
          customerReference: "FAULT-TEST",
          merchantReference: `FAULT-${Date.now()}`,
        },
        req: {
          get(name) {
            return name.toLowerCase() === "idempotency-key"
              ? `fault-${Date.now()}-${String(merchantId)}`
              : undefined;
          },
        },
      });

      const payment = await Payment.findById(result.payment.id)
        .select("+simulationFault")
        .lean();
      expect(payment.simulationFault).toMatchObject({
        type: "timeout",
        enabled: true,
        delayMs: 25,
      });
      expect(result.payment.simulationFault).toBeUndefined();
    } finally {
      await clearProviderFaults({ auth, config });
    }
  });

  it("passes a scoped demo decline through the real payment orchestrator", async () => {
    const auth = {
      merchantId,
      role: "MERCHANT",
      userId: new mongoose.Types.ObjectId(),
      isDemo: true,
    };
    await setProviderFaults({
      auth,
      config,
      body: {
        enabled: true,
        rules: [
          {
            type: "decline",
            enabled: true,
            code: "SYNTHETIC_DECLINE",
            message: "Synthetic decline test",
          },
        ],
      },
    });

    try {
      const created = await createPayment({
        auth,
        body: {
          amountMinor: "50000",
          currency: "USD",
          customerReference: "DECLINE-TEST",
          merchantReference: `DECLINE-${Date.now()}`,
        },
        req: {
          get(name) {
            return name.toLowerCase() === "idempotency-key"
              ? `decline-${Date.now()}-${String(merchantId)}`
              : undefined;
          },
        },
      });
      await Payment.updateOne(
        { _id: created.payment.id, merchantId },
        { $set: { status: PAYMENT_STATUS.QUEUED } },
      );

      let providerPayload;
      const orchestrator = await createPaymentOrchestratorService(
        config,
        logger,
        {
          providerClient: {
            async authorize(payload) {
              providerPayload = payload;
              return {
                data: {
                  status: "DECLINED",
                  operationId: payload.clientOperationId,
                  statusReason: "Synthetic decline test",
                  faultInjected: payload.simulationFault?.type,
                },
              };
            },
          },
        },
      );
      const initiated = await orchestrator.initiateAuthorization({
        auth,
        paymentId: created.payment.id,
        idempotencyKey: `decline-${created.payment.id}`,
      });
      const completed = await orchestrator.processAuthorization({
        auth,
        providerOperationId: String(initiated.providerOperation._id),
      });

      expect(providerPayload.simulationFault).toMatchObject({
        type: "decline",
        code: "SYNTHETIC_DECLINE",
      });
      expect(completed.payment.status).toBe(PAYMENT_STATUS.FAILED);
      expect(completed.providerOperation.faultInjected).toBe("decline");
    } finally {
      await clearProviderFaults({ auth, config });
    }
  });

  it("makes sequential and concurrent duplicate source events idempotent", async () => {
    const first = await post("duplicate-post");
    const replay = await post("duplicate-post");
    expect(first.idempotent).toBe(false);
    expect(replay.idempotent).toBe(true);

    const attempts = await Promise.allSettled(
      Array.from({ length: 100 }, () => post("concurrent-post")),
    );
    expect(attempts.some((attempt) => attempt.status === "fulfilled")).toBe(
      true,
    );
    expect(
      await Journal.countDocuments({ merchantId, sourceId: "concurrent-post" }),
    ).toBe(1);
  }, 60_000);

  it("does not book CREATED, QUEUED, or AUTHORIZED payment intents", async () => {
    const paymentIds = [];
    for (const status of [
      PAYMENT_STATUS.CREATED,
      PAYMENT_STATUS.QUEUED,
      PAYMENT_STATUS.AUTHORIZED,
    ]) {
      const [payment] = await Payment.create([
        {
          merchantId,
          reference: `NON-FINANCIAL-${status}-${Date.now()}`,
          amountMinor: 1250n,
          currency: "INR",
          status,
        },
      ]);
      paymentIds.push(String(payment._id));
    }

    expect(
      await Journal.countDocuments({
        merchantId,
        "metadata.paymentId": { $in: paymentIds },
      }),
    ).toBe(0);
  });

  it("prevents supported mutations of posted journals", async () => {
    const result = await post("immutable-post");
    await expect(
      Journal.updateOne(
        { _id: result.journal.id },
        { $set: { description: "rewrite" } },
      ),
    ).rejects.toMatchObject({ code: "POSTED_JOURNAL_IMMUTABLE" });
    await expect(
      Journal.deleteOne({ _id: result.journal.id }),
    ).rejects.toMatchObject({
      code: "POSTED_JOURNAL_IMMUTABLE",
    });
  });

  it("atomically captures, replays, refunds, and constrains refunds", async () => {
    const [payment] = await Payment.create([
      {
        merchantId,
        reference: `LEDGER-${Date.now()}`,
        amountMinor: 100000n,
        currency: "INR",
        status: PAYMENT_STATUS.CAPTURING,
      },
    ]);
    const capture = await confirmTrustedCapture({
      merchantId,
      paymentId: payment._id,
      providerEventId: `capture-${payment._id}`,
    });
    expect(capture.payment.status).toBe(PAYMENT_STATUS.CAPTURED);
    expect(capture.payment.capturedMinor).toBe("100000");
    expect(capture.journal.paymentId).toBe(String(payment._id));
    const replay = await confirmTrustedCapture({
      merchantId,
      paymentId: payment._id,
      providerEventId: `capture-${payment._id}`,
    });
    expect(replay.idempotent).toBe(true);

    const refund = await confirmTrustedRefund({
      merchantId,
      paymentId: payment._id,
      providerEventId: `refund-one-${payment._id}`,
      amountMinor: "40000",
    });
    expect(refund.payment.refundedMinor).toBe("40000");
    expect(refund.journal.reversalOfJournalId).toBe(capture.journal.id);
    await expect(
      confirmTrustedRefund({
        merchantId,
        paymentId: payment._id,
        providerEventId: `refund-too-large-${payment._id}`,
        amountMinor: "70000",
      }),
    ).rejects.toMatchObject({ code: "REFUND_EXCEEDS_CAPTURE" });
  });

  it("marks timed-out authorization unknown and reconciles with the same operation id", async () => {
    const payment = await Payment.create({
      merchantId,
      reference: `RECONCILE-${Date.now()}`,
      amountMinor: 4200n,
      currency: "INR",
      status: PAYMENT_STATUS.QUEUED,
      isDemo: true,
    });
    const auth = {
      merchantId,
      role: "system",
      userId: new mongoose.Types.ObjectId(),
      isDemo: true,
    };
    let dispatchedOperationId;
    let reconciledOperationId;
    const providerClient = {
      async authorize(payload) {
        dispatchedOperationId = payload.clientOperationId;
        const error = new Error("synthetic provider timeout");
        error.code = "PROVIDER_TIMEOUT";
        throw error;
      },
      async getOperation({ operationId }) {
        reconciledOperationId = operationId;
        return {
          data: {
            operationId,
            status: "SUCCEEDED",
            providerReference: `provider-${operationId}`,
          },
        };
      },
    };
    const orchestrator = await createPaymentOrchestratorService(
      config,
      logger,
      { providerClient },
    );

    const initiated = await orchestrator.initiateAuthorization({
      auth,
      paymentId: payment._id,
      idempotencyKey: `reconcile-${payment._id}`,
    });
    const operationId = String(initiated.providerOperation._id);
    const timedOut = await orchestrator.processAuthorization({
      auth,
      providerOperationId: operationId,
    });

    expect(timedOut.providerOperation.state).toBe(OPERATION_STATES.UNKNOWN);
    expect(timedOut.payment.status).toBe(PAYMENT_STATUS.UNKNOWN);
    expect(
      await OutboxEvent.countDocuments({
        merchantId,
        aggregateId: payment._id,
        eventType: OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED,
      }),
    ).toBe(1);

    const reconciled = await orchestrator.reconcileAuthorization({
      auth,
      providerOperationId: operationId,
    });
    expect(reconciled.payment.status).toBe(PAYMENT_STATUS.AUTHORIZED);
    expect(reconciled.providerOperation.state).toBe(OPERATION_STATES.SUCCEEDED);
    expect(dispatchedOperationId).toBe(reconciledOperationId);
    expect(
      await OutboxEvent.countDocuments({
        merchantId,
        aggregateId: payment._id,
        eventType: OUTBOX_EVENT_TYPES.PAYMENT_CAPTURE_REQUESTED,
      }),
    ).toBe(1);
  });

  it("reserves a requested refund without incrementing confirmed refundedMinor", async () => {
    const payment = await Payment.create({
      merchantId,
      reference: `REFUND-RESERVATION-${Date.now()}`,
      amountMinor: 10000n,
      currency: "INR",
      status: PAYMENT_STATUS.CAPTURING,
      isDemo: true,
    });

    await confirmTrustedCapture({
      merchantId,
      paymentId: payment._id,
      providerEventId: `capture-reservation-${payment._id}`,
      amountMinor: "10000",
      isDemo: true,
    });

    const refundService = await createRefundService(config, logger);
    const key = `refund-reservation-${Date.now()}`;
    const result = await refundService.requestRefund({
      auth: {
        merchantId,
        role: "MERCHANT",
        userId: new mongoose.Types.ObjectId(),
        isDemo: true,
      },
      paymentId: payment._id,
      body: {
        amountMinor: "2500",
        currency: "INR",
        reason: "Reservation regression test",
      },
      req: {
        get(name) {
          return name.toLowerCase() === "idempotency-key" ? key : undefined;
        },
      },
    });

    const persisted = await Payment.findById(payment._id).lean();
    expect(result.refund.status).toBe("REQUESTED");
    expect(result.refund.amountMinor).toBe("2500");
    expect(persisted.status).toBe(PAYMENT_STATUS.REFUND_PENDING);
    expect(persisted.refundedMinor.toString()).toBe("0");
  });

  it("does not let concurrent refunds exceed the captured amount", async () => {
    const [payment] = await Payment.create([
      {
        merchantId,
        reference: `CONCURRENT-${Date.now()}`,
        amountMinor: 100n,
        currency: "INR",
        status: PAYMENT_STATUS.CAPTURING,
      },
    ]);
    await confirmTrustedCapture({
      merchantId,
      paymentId: payment._id,
      providerEventId: `capture-${payment._id}`,
    });
    const outcomes = await Promise.allSettled([
      confirmTrustedRefund({
        merchantId,
        paymentId: payment._id,
        providerEventId: `refund-a-${payment._id}`,
        amountMinor: "60",
      }),
      confirmTrustedRefund({
        merchantId,
        paymentId: payment._id,
        providerEventId: `refund-b-${payment._id}`,
        amountMinor: "60",
      }),
    ]);
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const persisted = await Payment.findById(payment._id).lean();
    expect(BigInt(persisted.refundedMinor)).toBeLessThanOrEqual(
      BigInt(persisted.amountMinor),
    );
  }, 30_000);

  it("commits exactly one capture journal under 100 concurrent confirmations", async () => {
    const [payment] = await Payment.create([
      {
        merchantId,
        reference: `CAPTURE-RACE-${Date.now()}`,
        amountMinor: 2500n,
        currency: "INR",
        status: PAYMENT_STATUS.CAPTURING,
      },
    ]);
    const providerEventId = `capture-race-${payment._id}`;
    const outcomes = await Promise.allSettled(
      Array.from({ length: 100 }, () =>
        confirmTrustedCapture({
          merchantId,
          paymentId: payment._id,
          providerEventId,
        }),
      ),
    );
    const fulfilled = outcomes.filter(
      (result) => result.status === "fulfilled",
    );
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(
      await Journal.countDocuments({
        merchantId,
        sourceType: "PROVIDER_CAPTURE",
        sourceId: providerEventId,
      }),
    ).toBe(1);
    const persisted = await Payment.findById(payment._id).lean();
    expect(persisted.status).toBe(PAYMENT_STATUS.CAPTURED);
    expect(persisted.capturedMinor.toString()).toBe("2500");
  }, 60_000);

  it("rolls back a payment transition when ledger posting fails", async () => {
    const [payment] = await Payment.create([
      {
        merchantId,
        reference: `ROLLBACK-${Date.now()}`,
        amountMinor: 500n,
        currency: "INR",
        status: PAYMENT_STATUS.CAPTURING,
      },
    ]);
    await expect(
      confirmTrustedCapture({
        merchantId,
        paymentId: payment._id,
        providerEventId: `failed-${payment._id}`,
        injectFailure: true,
      }),
    ).rejects.toThrow("Injected");
    const persisted = await Payment.findById(payment._id).lean();
    expect(persisted.status).toBe(PAYMENT_STATUS.CAPTURING);
    expect(
      await Journal.countDocuments({
        merchantId,
        sourceId: `failed-${payment._id}`,
      }),
    ).toBe(0);
  });

  it("serves merchant-scoped ledger and integrity APIs with role enforcement", async () => {
    const merchantSession = await request(app)
      .post("/api/v1/demo/session")
      .send({ role: "MERCHANT" })
      .expect(201);
    const merchantToken = merchantSession.body.data.accessToken;

    const accountsResponse = await request(app)
      .get("/api/v1/ledger/accounts?currency=USD&limit=100")
      .set("Authorization", `Bearer ${merchantToken}`)
      .expect(200);
    expect(accountsResponse.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(
      accountsResponse.body.data.items.every(
        (account) => account.currency === "USD",
      ),
    ).toBe(true);

    const inrAccounts = await request(app)
      .get("/api/v1/ledger/accounts?currency=INR&limit=100")
      .set("Authorization", `Bearer ${merchantToken}`)
      .expect(200);
    expect(
      inrAccounts.body.data.items.every(
        (account) => account.currency === "INR",
      ),
    ).toBe(true);
    expect(inrAccounts.body.data.items.length).toBeGreaterThanOrEqual(2);

    const inrJournals = await request(app)
      .get("/api/v1/ledger/journals?currency=INR&limit=10")
      .set("Authorization", `Bearer ${merchantToken}`)
      .expect(200);
    expect(inrJournals.body.data.items.length).toBeGreaterThan(0);

    const journalsResponse = await request(app)
      .get("/api/v1/ledger/journals?currency=USD&limit=10")
      .set("Authorization", `Bearer ${merchantToken}`)
      .expect(200);
    expect(journalsResponse.body.data.items.length).toBeGreaterThan(0);
    expect(journalsResponse.body.data.items[0].entries).toHaveLength(2);

    const searchResponse = await request(app)
      .get("/api/v1/ledger/journals?currency=USD&search=JRN-")
      .set("Authorization", `Bearer ${merchantToken}`)
      .expect(200);
    expect(searchResponse.body.data.items.length).toBeGreaterThan(0);

    await request(app)
      .post("/api/v1/ledger/integrity/check")
      .set("Authorization", `Bearer ${merchantToken}`)
      .send({ currency: "USD" })
      .expect(403);

    const tampered = await request(app)
      .post("/api/v1/ledger/integrity/check")
      .send({ currency: "USD" })
      .expect(401);
    expect(tampered.body.error.code).toBeTruthy();

    const adminSession = await request(app)
      .post("/api/v1/demo/session")
      .send({ role: "ADMIN" })
      .expect(201);
    const adminToken = adminSession.body.data.accessToken;
    const integrityResponse = await request(app)
      .post("/api/v1/ledger/integrity/check")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ currency: "USD" })
      .expect(201);
    expect(["PASS", "FAIL", "INCONCLUSIVE"]).toContain(
      integrityResponse.body.data.status,
    );
    expect(integrityResponse.body.data.checks.length).toBeGreaterThan(5);

    const reportsResponse = await request(app)
      .get("/api/v1/ledger/integrity/reports")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const reportId = reportsResponse.body.data.items[0].id;
    await request(app)
      .get(`/api/v1/ledger/integrity/reports/${reportId}`)
      .set("Authorization", `Bearer ${merchantToken}`)
      .expect(404);

    const reconciliationResponse = await request(app)
      .get("/api/v1/reconciliation?limit=10")
      .set("Authorization", `Bearer ${merchantToken}`)
      .expect(200);
    expect(reconciliationResponse.body.data.items.length).toBeGreaterThan(0);
    expect(reconciliationResponse.body.data.summary).toBeTruthy();
  }, 30_000);

  it("detects a deliberately corrupted fixture without mutating it", async () => {
    const corruptId = new mongoose.Types.ObjectId();
    await Journal.collection.insertOne({
      _id: corruptId,
      merchantId,
      journalReference: `CORRUPT-${corruptId}`,
      sourceType: "CORRUPT_FIXTURE",
      sourceId: String(corruptId),
      eventType: "CAPTURE",
      currency: "INR",
      status: "POSTED",
      entries: [
        {
          accountId: accounts.PROVIDER_CLEARING._id,
          direction: "DEBIT",
          amountMinor: 10n,
        },
        {
          accountId: accounts.MERCHANT_PAYABLE._id,
          direction: "CREDIT",
          amountMinor: 9n,
        },
      ],
      postedAt: new Date(),
      createdAt: new Date(),
      createdBy: "corruption-test",
    });
    const report = await executeIntegrityCheck({
      auth: { merchantId, role: "ADMIN", isDemo: false },
      requestId: "integration-integrity",
      config,
    });
    expect(report.status).toBe("FAIL");
    expect(
      report.checks.find((check) => check.checkId === "balanced-journals")
        .status,
    ).toBe("FAIL");
    expect(await Journal.collection.countDocuments({ _id: corruptId })).toBe(1);
  });
});

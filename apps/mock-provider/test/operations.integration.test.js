import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ProviderOperation } from "../src/modules/operations/provider-operation.model.js";
import { createProviderApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import {
  connectMongo,
  disconnectMongo,
  pingMongo,
} from "../src/db/mongoose.js";

const enabled = process.env.RUN_INTEGRATION_TESTS === "1";
const logger = { info() {}, warn() {}, error() {} };

describe.skipIf(!enabled)("Mock provider operations", () => {
  const merchantId = "merchant_test_123";
  let app;
  let config;

  beforeAll(async () => {
    config = loadConfig();
    await connectMongo(config.mongodb, logger);
    await ProviderOperation.init();
    app = createProviderApp({
      database: { ping: () => pingMongo() },
      config,
      logger,
    });
  }, 60_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await ProviderOperation.collection.deleteMany({ merchantId });
    await disconnectMongo();
  });

  function authHeaders() {
    return { "x-merchant-id": merchantId };
  }

  function baseAuthRequest() {
    return {
      clientOperationId: `client-op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amountMinor: "10000",
      currency: "INR",
      idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      merchantId,
      paymentMethod: { type: "card", token: "tok_test_123" },
      description: "Test authorization",
    };
  }

  it("creates an authorization successfully", async () => {
    const body = baseAuthRequest();
    const res = await request(app)
      .post("/provider/v1/authorizations")
      .set(authHeaders())
      .send(body)
      .expect(201);

    expect(res.body.data.operationId).toBeTruthy();
    expect(res.body.data.type).toBe("AUTHORIZATION");
    expect(res.body.data.status).toBe("SUCCEEDED");
    expect(res.body.data.providerReference).toBeTruthy();
    expect(res.body.data.amountMinor).toBe("10000");
    expect(res.body.data.currency).toBe("INR");
    expect(res.body.data.idempotent).toBe(false);
  });

  it("returns idempotent response for duplicate authorization with same payload", async () => {
    const body = baseAuthRequest();
    await request(app)
      .post("/provider/v1/authorizations")
      .set(authHeaders())
      .send(body)
      .expect(201);

    const res = await request(app)
      .post("/provider/v1/authorizations")
      .set(authHeaders())
      .send(body)
      .expect(200);

    expect(res.body.data.idempotent).toBe(true);
    expect(res.body.data.status).toBe("SUCCEEDED");
  });

  it("rejects duplicate authorization with conflicting payload", async () => {
    const body = baseAuthRequest();
    await request(app)
      .post("/provider/v1/authorizations")
      .set(authHeaders())
      .send(body)
      .expect(201);

    const conflictingBody = { ...body, amountMinor: "20000" };
    const res = await request(app)
      .post("/provider/v1/authorizations")
      .set(authHeaders())
      .send(conflictingBody)
      .expect(409);

    expect(res.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("creates a capture successfully", async () => {
    const authBody = baseAuthRequest();
    const authRes = await request(app)
      .post("/provider/v1/authorizations")
      .set(authHeaders())
      .send(authBody)
      .expect(201);

    const captureBody = {
      clientOperationId: `client-cap-${Date.now()}`,
      authorizationOperationId: authRes.body.data.operationId,
      amountMinor: "10000",
      currency: "INR",
      idempotencyKey: `idem-cap-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      merchantId,
    };

    const res = await request(app)
      .post("/provider/v1/captures")
      .set(authHeaders())
      .send(captureBody)
      .expect(201);

    expect(res.body.data.operationId).toBeTruthy();
    expect(res.body.data.type).toBe("CAPTURE");
    expect(res.body.data.status).toBe("SUCCEEDED");
    expect(res.body.data.providerReference).toBeTruthy();
  });

  it("creates a refund successfully", async () => {
    const authBody = baseAuthRequest();
    const authRes = await request(app)
      .post("/provider/v1/authorizations")
      .set(authHeaders())
      .send(authBody)
      .expect(201);

    const captureBody = {
      clientOperationId: `client-cap-${Date.now()}`,
      authorizationOperationId: authRes.body.data.operationId,
      amountMinor: "10000",
      currency: "INR",
      idempotencyKey: `idem-cap-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      merchantId,
    };
    const captureRes = await request(app)
      .post("/provider/v1/captures")
      .set(authHeaders())
      .send(captureBody)
      .expect(201);

    const refundBody = {
      clientOperationId: `client-ref-${Date.now()}`,
      captureOperationId: captureRes.body.data.operationId,
      amountMinor: "5000",
      currency: "INR",
      idempotencyKey: `idem-ref-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      merchantId,
      reason: "Customer request",
    };

    const res = await request(app)
      .post("/provider/v1/refunds")
      .set(authHeaders())
      .send(refundBody)
      .expect(201);

    expect(res.body.data.operationId).toBeTruthy();
    expect(res.body.data.type).toBe("REFUND");
    expect(res.body.data.status).toBe("SUCCEEDED");
    expect(res.body.data.providerReference).toBeTruthy();
    expect(res.body.data.amountMinor).toBe("5000");
  });

  it("gets an operation by ID", async () => {
    const body = baseAuthRequest();
    const createRes = await request(app)
      .post("/provider/v1/authorizations")
      .set(authHeaders())
      .send(body)
      .expect(201);

    const res = await request(app)
      .get(`/provider/v1/operations/${createRes.body.data.operationId}`)
      .set(authHeaders())
      .expect(200);

    expect(res.body.data.operationId).toBe(createRes.body.data.operationId);
    expect(res.body.data.type).toBe("AUTHORIZATION");
    expect(res.body.data.status).toBe("SUCCEEDED");
  });

  it("lists operations for a merchant", async () => {
    const res = await request(app)
      .get("/provider/v1/operations")
      .set(authHeaders())
      .query({ limit: 10 })
      .expect(200);

    expect(res.body.data.operations).toBeInstanceOf(Array);
    expect(res.body.data.count).toBeGreaterThanOrEqual(0);
  });

  it("returns 404 for non-existent operation", async () => {
    const res = await request(app)
      .get("/provider/v1/operations/op_nonexistent123")
      .set(authHeaders())
      .expect(404);

    expect(res.body.error.code).toBe("OPERATION_NOT_FOUND");
  });
});

describe("Mock provider operations (unit, no DB)", () => {
  beforeAll(async () => {
    vi.resetModules();
    process.env.PROVIDER_MONGODB_URI =
      "mongodb+srv://provider.example.invalid/pratyaya_test";
    process.env.NODE_ENV = "test";
    process.env.PROVIDERS = JSON.stringify([
      {
        providerId: "alpha",
        baseUrl: "http://localhost:4100",
        hmacSecret: "test-secret-key-for-testing-32chars",
        timeoutMs: 15000,
        retryAttempts: 3,
      },
    ]);
  });

  it("loads config with fault injection", async () => {
    process.env.PROVIDER_FAULTS = JSON.stringify({
      enabled: true,
      rules: [{ type: "timeout", enabled: true, delayMs: 100 }],
    });
    const { loadConfig } = await import("../src/config/env.js");
    const config = loadConfig();
    expect(config.faults.enabled).toBe(true);
    expect(config.faults.rules[0].type).toBe("timeout");
  });
});

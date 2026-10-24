import { createHmac } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ProviderOperation } from "../src/modules/operations/provider-operation.model.js";
import { migrateProviderOperationIndexes } from "../migrations/001-provider-operation-indexes.js";
import { createProviderApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import {
  connectMongo,
  disconnectMongo,
  pingMongo,
} from "../src/db/mongoose.js";

const enabled = process.env.RUN_INTEGRATION_TESTS === "1";
const logger = {
  info() {},
  warn() {},
  error(context, message) {
    if (process.env.DEBUG_INTEGRATION_TESTS === "1") {
      console.error(message, context);
    }
  },
};

describe.skipIf(!enabled)("Mock provider operations", () => {
  const merchantId = "merchant_test_123";
  let app;
  let config;

  beforeAll(async () => {
    config = loadConfig();
    await connectMongo(config.mongodb, logger);
    await migrateProviderOperationIndexes(logger);
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

  function authHeaders(body = undefined) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = body === undefined ? "" : JSON.stringify(body);
    const secret = config.providers[0].hmacSecret;
    return {
      "x-merchant-id": merchantId,
      "x-provider-id": config.providers[0].providerId,
      "x-timestamp": timestamp,
      "x-signature": createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex"),
    };
  }

  function signedPost(path, body) {
    return request(app)
      .post(`/provider/${config.providers[0].providerId}${path}`)
      .set(authHeaders(body))
      .send(body);
  }

  function signedGet(path) {
    return request(app)
      .get(`/provider/${config.providers[0].providerId}${path}`)
      .set(authHeaders());
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
    const res = await signedPost("/v1/authorizations", body).expect(201);

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
    await signedPost("/v1/authorizations", body).expect(201);

    const res = await signedPost("/v1/authorizations", body).expect(200);

    expect(res.body.data.idempotent).toBe(true);
    expect(res.body.data.status).toBe("SUCCEEDED");
  });

  it("rejects duplicate authorization with conflicting payload", async () => {
    const body = baseAuthRequest();
    await signedPost("/v1/authorizations", body).expect(201);

    const conflictingBody = { ...body, amountMinor: "20000" };
    const res = await signedPost("/v1/authorizations", conflictingBody).expect(
      409,
    );

    expect(res.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("creates a capture successfully", async () => {
    const authBody = baseAuthRequest();
    const authRes = await signedPost("/v1/authorizations", authBody).expect(
      201,
    );

    const captureBody = {
      clientOperationId: `client-cap-${Date.now()}`,
      authorizationOperationId: authRes.body.data.operationId,
      amountMinor: "10000",
      currency: "INR",
      idempotencyKey: `idem-cap-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      merchantId,
    };

    const res = await signedPost("/v1/captures", captureBody).expect(201);

    expect(res.body.data.operationId).toBeTruthy();
    expect(res.body.data.type).toBe("CAPTURE");
    expect(res.body.data.status).toBe("SUCCEEDED");
    expect(res.body.data.providerReference).toBeTruthy();
  });

  it("creates a refund successfully", async () => {
    const authBody = baseAuthRequest();
    const authRes = await signedPost("/v1/authorizations", authBody).expect(
      201,
    );

    const captureBody = {
      clientOperationId: `client-cap-${Date.now()}`,
      authorizationOperationId: authRes.body.data.operationId,
      amountMinor: "10000",
      currency: "INR",
      idempotencyKey: `idem-cap-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      merchantId,
    };
    const captureRes = await signedPost("/v1/captures", captureBody).expect(
      201,
    );

    const refundBody = {
      clientOperationId: `client-ref-${Date.now()}`,
      captureOperationId: captureRes.body.data.operationId,
      amountMinor: "5000",
      currency: "INR",
      idempotencyKey: `idem-ref-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      merchantId,
      reason: "Customer request",
    };

    const res = await signedPost("/v1/refunds", refundBody).expect(201);

    expect(res.body.data.operationId).toBeTruthy();
    expect(res.body.data.type).toBe("REFUND");
    expect(res.body.data.status).toBe("SUCCEEDED");
    expect(res.body.data.providerReference).toBeTruthy();
    expect(res.body.data.amountMinor).toBe("5000");
  });

  it("gets an operation by ID", async () => {
    const body = baseAuthRequest();
    const createRes = await signedPost("/v1/authorizations", body).expect(201);

    const res = await signedGet(
      `/v1/operations/${createRes.body.data.operationId}`,
    ).expect(200);

    expect(res.body.data.operationId).toBe(createRes.body.data.operationId);
    expect(res.body.data.type).toBe("AUTHORIZATION");
    expect(res.body.data.status).toBe("SUCCEEDED");
  });

  it("lists operations for a merchant", async () => {
    const res = await signedGet("/v1/operations")
      .query({ limit: 10 })
      .expect(200);

    expect(res.body.data.operations).toBeInstanceOf(Array);
    expect(res.body.data.count).toBeGreaterThanOrEqual(0);
  });

  it("returns 404 for non-existent operation", async () => {
    const res = await signedGet("/v1/operations/op_nonexistent123").expect(404);

    expect(res.body.error.code).toBe("OPERATION_NOT_FOUND");
  });
});

describe("Mock provider operations (unit, no DB)", () => {
  beforeAll(async () => {
    vi.resetModules();
    process.env.PROVIDER_MONGODB_URI =
      "mongodb+srv://provider.example.invalid/pratyaya_test";
    process.env.NODE_ENV = "test";
    process.env.MOCK_PROVIDER_HMAC_SECRET =
      "test-mock-provider-secret-at-least-32-chars";
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

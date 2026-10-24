import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { parseConfig } from "../src/config/env.js";

function testConfig() {
  return parseConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    MONGODB_URI: "mongodb+srv://cluster.example.invalid/pratyaya_test",
  });
}

function testLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function harness({ dbOk = true, databaseStatus = "connected" } = {}) {
  const database = {
    ping: vi.fn(async () => {
      if (!dbOk) throw new Error("database unavailable");
    }),
    status: vi.fn(() => databaseStatus),
  };

  return {
    app: createApp({
      database,
      config: testConfig(),
      logger: testLogger(),
    }),
    database,
  };
}

describe("Pratyaya API health endpoints", () => {
  it("reports liveness without depending on MongoDB", async () => {
    const { app, database } = harness();

    const response = await request(app).get("/api/v1/health/live").expect(200);

    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.service).toBe("pratyaya-api");
    expect(response.body.meta.requestId).toBe(response.headers["x-request-id"]);
    expect(database.ping).not.toHaveBeenCalled();
  });

  it("echoes a valid caller request id and replaces invalid values", async () => {
    const { app } = harness();

    const echoed = await request(app)
      .get("/api/v1/health/live")
      .set("X-Request-ID", "client-request-1234")
      .expect(200);

    expect(echoed.headers["x-request-id"]).toBe("client-request-1234");

    const replaced = await request(app)
      .get("/api/v1/health/live")
      .set("X-Request-ID", "short")
      .expect(200);

    expect(replaced.headers["x-request-id"]).not.toBe("short");
    expect(replaced.headers["x-request-id"]).toHaveLength(36);
  });

  it("reports readiness when MongoDB is reachable", async () => {
    const { app } = harness();

    const response = await request(app).get("/api/v1/health/ready").expect(200);

    expect(response.body.data.status).toBe("ready");
    expect(response.body.data.checks.database.status).toBe("up");
  });

  it("returns 503 with dependency detail when MongoDB is unavailable", async () => {
    const { app } = harness({ dbOk: false });

    const response = await request(app).get("/api/v1/health/ready").expect(503);

    expect(response.body.data.status).toBe("not_ready");
    expect(response.body.data.checks.database).toMatchObject({
      status: "down",
      code: "DATABASE_UNAVAILABLE",
    });
    expect(response.body).not.toHaveProperty("stack");
  });

  it("uses a consistent error envelope for unknown routes", async () => {
    const { app } = harness();

    const response = await request(app)
      .get("/api/v1/does-not-exist")
      .expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.meta.requestId).toBe(response.headers["x-request-id"]);
  });

  it("serves service metadata and the OpenAPI document", async () => {
    const { app } = harness();

    const root = await request(app).get("/").expect(200);
    expect(root.body.data.documentation).toBe("/api-docs");

    const spec = await request(app).get("/api-docs/openapi.json").expect(200);
    expect(spec.body.openapi).toBe("3.1.0");
    expect(spec.body.paths["/health/live"]).toBeDefined();
  });

  it("serves non-secret system information", async () => {
    const { app } = harness();

    const response = await request(app).get("/api/v1/system/info").expect(200);

    expect(response.body.data).toMatchObject({
      service: "pratyaya-api",
      database: {
        engine: "mongodb",
        status: "connected",
        transactionsRequireReplicaSet: true,
      },
      simulationOnly: true,
    });
    expect(JSON.stringify(response.body)).not.toMatch(/mongodb:\/\//i);
  });

  it("maps malformed JSON to a 400 error envelope", async () => {
    const { app } = harness();

    const response = await request(app)
      .post("/api/v1/health/live")
      .set("Content-Type", "application/json")
      .send('{"broken":')
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  it("protects ledger reads and exposes no general-purpose posting endpoint", async () => {
    const { app } = harness();

    const read = await request(app).get("/api/v1/ledger/journals").expect(401);
    expect(read.body.error.code).toBe("UNAUTHENTICATED");

    const write = await request(app)
      .post("/api/v1/ledger/journals")
      .send({})
      .expect(404);
    expect(write.body.error.code).toBe("NOT_FOUND");
  });

  it("protects refund reads and mutations at their public route shapes", async () => {
    const { app } = harness();
    const id = "507f1f77bcf86cd799439011";

    const list = await request(app)
      .get(`/api/v1/payments/${id}/refunds`)
      .expect(401);
    expect(list.body.error.code).toBe("UNAUTHENTICATED");

    const create = await request(app)
      .post(`/api/v1/payments/${id}/refunds`)
      .send({ amountMinor: "100", currency: "INR" })
      .expect(401);
    expect(create.body.error.code).toBe("UNAUTHENTICATED");

    const detail = await request(app)
      .get(`/api/v1/payments/refunds/${id}`)
      .expect(401);
    expect(detail.body.error.code).toBe("UNAUTHENTICATED");
  });
});

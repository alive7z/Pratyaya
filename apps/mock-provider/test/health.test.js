import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createProviderApp } from "../src/app.js";

function config() {
  return {
    service: { name: "pratyaya-mock-provider", version: "0.1.0" },
  };
}

function logger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function providerApp(dbOk = true) {
  return createProviderApp({
    config: config(),
    logger: logger(),
    database: {
      ping: vi.fn(async () => {
        if (!dbOk) throw new Error("provider database unavailable");
      }),
    },
  });
}

describe("mock provider health", () => {
  it("reports liveness and its simulation-only identity", async () => {
    const app = providerApp();
    const response = await request(app).get("/health/live").expect(200);

    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.service).toBe("pratyaya-mock-provider");
    expect(response.body.meta.requestId).toBe(response.headers["x-request-id"]);
  });

  it("reports readiness from its own database", async () => {
    const app = providerApp();
    const response = await request(app).get("/health/ready").expect(200);

    expect(response.body.data.status).toBe("ready");
    expect(response.body.data.checks.database.status).toBe("up");
  });

  it("returns 503 when the provider database is unavailable", async () => {
    const app = providerApp(false);
    const response = await request(app).get("/health/ready").expect(503);

    expect(response.body.data.status).toBe("not_ready");
    expect(response.body.data.checks.database).toMatchObject({
      status: "down",
      code: "PROVIDER_DATABASE_UNAVAILABLE",
    });
  });

  it("returns a structured 404 and handles malformed JSON", async () => {
    const app = providerApp();
    const missing = await request(app).get("/missing").expect(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");

    const malformed = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send("{")
      .expect(400);
    expect(malformed.body.error.code).toBe("INVALID_JSON");
  });
});

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password.js";
import {
  InvalidTokenError,
  issueAccessToken,
  verifyAccessToken,
} from "../src/lib/tokens.js";
import { requireCsrf } from "../src/middleware/csrf.js";

const secret = "test-only-pratyaya-secret-at-least-32-characters";
const tokenInput = {
  userId: "64b000000000000000000101",
  sessionId: "64b000000000000000000201",
  role: "MERCHANT",
  merchantId: "64b000000000000000000001",
  isDemo: true,
  secret,
  issuer: "pratyaya-api",
  audience: "pratyaya-web",
  ttlSeconds: 900,
};

function csrfApp() {
  const app = express();
  app.post("/mutate", requireCsrf, (req, res) => res.json({ ok: true }));
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode ?? 500).json({ code: error.code });
  });
  return app;
}

describe("authentication primitives", () => {
  it("hashes and verifies passwords without storing the plaintext", async () => {
    const encoded = await hashPassword("correct horse battery staple");

    expect(encoded).toMatch(/^scrypt\$/);
    expect(encoded).not.toContain("correct horse battery staple");
    await expect(
      verifyPassword("correct horse battery staple", encoded),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong password", encoded)).resolves.toBe(
      false,
    );
  });

  it("issues and verifies signed HS256 access tokens", () => {
    const issued = issueAccessToken(tokenInput);
    const payload = verifyAccessToken(issued.token, {
      secret,
      issuer: tokenInput.issuer,
      audience: tokenInput.audience,
    });

    expect(payload).toMatchObject({
      sub: tokenInput.userId,
      sid: tokenInput.sessionId,
      role: "MERCHANT",
      mid: tokenInput.merchantId,
      demo: true,
    });
  });

  it("rejects tampered, expired, and wrong-audience tokens", () => {
    const issued = issueAccessToken(tokenInput);
    const [header, payload, signature] = issued.token.split(".");
    const changedFirstCharacter = signature[0] === "A" ? "B" : "A";
    const tampered = `${header}.${payload}.${changedFirstCharacter}${signature.slice(1)}`;

    expect(() =>
      verifyAccessToken(tampered, {
        secret,
        issuer: tokenInput.issuer,
        audience: tokenInput.audience,
      }),
    ).toThrow(InvalidTokenError);

    const expired = issueAccessToken({
      ...tokenInput,
      ttlSeconds: 1,
      now: Date.now() - 10_000,
    });
    expect(() =>
      verifyAccessToken(expired.token, {
        secret,
        issuer: tokenInput.issuer,
        audience: tokenInput.audience,
      }),
    ).toThrow(InvalidTokenError);

    expect(() =>
      verifyAccessToken(issued.token, {
        secret,
        issuer: tokenInput.issuer,
        audience: "another-audience",
      }),
    ).toThrow(InvalidTokenError);
  });
});

describe("CSRF double-submit protection", () => {
  it("denies cookie-authenticated mutations without matching tokens", async () => {
    const app = csrfApp();

    await request(app).post("/mutate").expect(403);

    await request(app)
      .post("/mutate")
      .set("Cookie", "pratyaya_csrf=expected-token")
      .set("X-CSRF-Token", "different-token")
      .expect(403);
  });

  it("allows matching cookie/header tokens and bearer clients", async () => {
    const app = csrfApp();

    await request(app)
      .post("/mutate")
      .set("Cookie", "pratyaya_csrf=expected-token")
      .set("X-CSRF-Token", "expected-token")
      .expect(200);

    await request(app)
      .post("/mutate")
      .set("Authorization", "Bearer signed-access-token")
      .expect(200);
  });
});

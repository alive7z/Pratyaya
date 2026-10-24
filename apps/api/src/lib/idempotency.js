import { createHash } from "node:crypto";
import { AppError } from "../lib/errors.js";

const HEADER_NAME = "idempotency-key";

export function getIdempotencyKey(req) {
  const header = req.get(HEADER_NAME) ?? req.get("Idempotency-Key");
  if (!header || !String(header).trim()) {
    throw new AppError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key header is required",
    );
  }
  return String(header).trim();
}

export function hashIdempotencyKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

export function hashPayload(fingerprint) {
  return createHash("sha256").update(fingerprint).digest("hex");
}

export function fingerprintPaymentCreate(body) {
  const canonical = {
    amountMinor: body.amountMinor,
    currency: body.currency,
    description: body.description ?? null,
    customerReference: body.customerReference ?? null,
    merchantReference: body.merchantReference ?? null,
    metadata: body.metadata ?? null,
  };
  return JSON.stringify(canonical);
}

export function fingerprintObject(obj) {
  return JSON.stringify(obj);
}

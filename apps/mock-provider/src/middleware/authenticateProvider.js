import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../lib/errors.js";

const MAX_CLOCK_SKEW_SECONDS = 300;

export function authenticateProvider(req, _res, next) {
  const timestamp = req.get("X-Timestamp");
  const signature = req.get("X-Signature");
  const secret = req.providerConfig?.hmacSecret;

  if (!timestamp || !signature || !secret || !/^\d+$/.test(timestamp)) {
    return next(
      new AppError(
        401,
        "PROVIDER_AUTHENTICATION_FAILED",
        "Valid provider authentication headers are required",
      ),
    );
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > MAX_CLOCK_SKEW_SECONDS) {
    return next(
      new AppError(
        401,
        "PROVIDER_TIMESTAMP_EXPIRED",
        "Provider request timestamp is outside the allowed window",
      ),
    );
  }

  const rawBody = req.rawBody?.toString("utf8") ?? "";
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return next(
      new AppError(
        401,
        "PROVIDER_AUTHENTICATION_FAILED",
        "Provider request signature is invalid",
      ),
    );
  }

  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return next(
      new AppError(
        401,
        "PROVIDER_AUTHENTICATION_FAILED",
        "Provider request signature is invalid",
      ),
    );
  }

  return next();
}

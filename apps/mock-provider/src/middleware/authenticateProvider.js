import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../lib/errors.js";

const MAX_CLOCK_SKEW_SECONDS = 300;
const SIGNATURE_PATTERN = /^[a-fA-F0-9]{64}$/;

function authenticationError() {
  return new AppError(
    401,
    "PROVIDER_AUTHENTICATION_FAILED",
    "Provider request authentication failed",
  );
}

export function authenticateProvider(req, _res, next) {
  try {
    const timestamp = req.get("X-Timestamp");
    const signature = req.get("X-Signature");
    const secret = req.providerConfig?.hmacSecret;

    if (
      typeof timestamp !== "string" ||
      !/^\d{10}$/.test(timestamp) ||
      typeof signature !== "string" ||
      !SIGNATURE_PATTERN.test(signature) ||
      typeof secret !== "string" ||
      secret.length < 32
    ) {
      return next(authenticationError());
    }

    const timestampSeconds = Number(timestamp);
    const currentSeconds = Math.floor(Date.now() / 1000);

    if (
      !Number.isSafeInteger(timestampSeconds) ||
      Math.abs(currentSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS
    ) {
      return next(
        new AppError(
          401,
          "PROVIDER_TIMESTAMP_EXPIRED",
          "Provider request timestamp is outside the allowed window",
        ),
      );
    }

    const isBodylessRequest = req.method === "GET" || req.method === "HEAD";

    let rawBody;

    if (Buffer.isBuffer(req.rawBody)) {
      rawBody = req.rawBody;
    } else if (isBodylessRequest) {
      rawBody = Buffer.alloc(0);
    } else {
      return next(authenticationError());
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(timestamp)
      .update(".")
      .update(rawBody)
      .digest();

    const providedSignature = Buffer.from(signature, "hex");

    if (
      providedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(providedSignature, expectedSignature)
    ) {
      return next(authenticationError());
    }

    return next();
  } catch {
    return next(authenticationError());
  }
}

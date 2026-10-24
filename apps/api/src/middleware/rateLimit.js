import rateLimit from "express-rate-limit";
import { responseMeta } from "../lib/response.js";

function rateLimitResponse(req, res, code, message) {
  res.status(429).json({
    error: { code, message },
    meta: responseMeta(req.requestId),
  });
}

export function createApiRateLimiter(config) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      rateLimitResponse(
        req,
        res,
        "RATE_LIMITED",
        "Too many requests. Retry later.",
      );
    },
  });
}

export function createDemoSessionRateLimiter(config) {
  return rateLimit({
    windowMs: config.demo.rateLimitWindowMs,
    limit: config.demo.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      rateLimitResponse(
        req,
        res,
        "DEMO_RATE_LIMITED",
        "Too many demo sessions were requested. Try again later.",
      );
    },
  });
}

export function createAuthRateLimiter(config) {
  return rateLimit({
    windowMs: Math.min(config.rateLimitWindowMs, 900_000),
    limit: Math.max(10, Math.ceil(config.rateLimitMax / 2)),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler(req, res) {
      rateLimitResponse(
        req,
        res,
        "AUTH_RATE_LIMITED",
        "Too many authentication attempts. Try again later.",
      );
    },
  });
}

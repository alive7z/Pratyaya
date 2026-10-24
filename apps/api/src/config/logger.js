import pino from "pino";

export function createLogger({
  level = "info",
  service = "pratyaya-api",
} = {}) {
  return pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: (error) => ({
        type: error.name,
        message: String(error.message).replace(
          /mongodb(?:\+srv)?:\/\/[^\s"']+/gi,
          "[REDACTED_MONGODB_URI]",
        ),
        stack: String(error.stack ?? "").replace(
          /mongodb(?:\+srv)?:\/\/[^\s"']+/gi,
          "[REDACTED_MONGODB_URI]",
        ),
      }),
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'res.headers["set-cookie"]',
        "password",
        "passwordHash",
        "token",
        "accessToken",
        "refreshToken",
        "secret",
      ],
      censor: "[REDACTED]",
    },
  });
}

import pino from "pino";

export function createLogger({
  level = "info",
  service = "pratyaya-mock-provider",
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
      paths: ["secret", "signature", "authorization", "password"],
      censor: "[REDACTED]",
    },
  });
}

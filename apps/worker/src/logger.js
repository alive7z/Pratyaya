import pino from "pino";

export function createLogger({
  level = "info",
  service = "pratyaya-worker",
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
      paths: ["password", "secret", "token", "authorization"],
      censor: "[REDACTED]",
    },
  });
}

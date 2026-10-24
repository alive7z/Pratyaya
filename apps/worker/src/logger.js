import pino from "pino";

export function createLogger({ level = "info", service = "pratyaya-worker" }) {
  return pino({
    level,
    base: { service },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "*.password",
        "*.secret",
        "*.token",
        "*.authorization",
        "*.cookie",
        "*.mongodbUri",
        "*.hmacSecret",
        "req.headers.authorization",
        "req.headers.cookie",
      ],
      censor: "[REDACTED]",
    },
  });
}

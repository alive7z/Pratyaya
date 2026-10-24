
import pino from "pino";

const REDACTED = "[REDACTED]";

function sanitize(value) {
  return String(value ?? "")
    .replace(
      /mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi,
      REDACTED,
    )
    .replace(
      /(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi,
      REDACTED,
    );
}

function serializeError(error) {
  if (!error) return undefined;

  return {
    type: error.name ?? "Error",
    message: sanitize(error.message),
    stack: sanitize(error.stack),
    ...(error.code && { code: error.code }),
  };
}

export function createLogger({
  level = "info",
  service = "pratyaya-mock-provider",
} = {}) {
  return pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,

    serializers: {
      err: serializeError,
      error: serializeError,
    },

    redact: {
      paths: [
        "secret",
        "password",
        "authorization",
        "signature",
        "token",
        "accessToken",
        "refreshToken",
        "hmacSecret",
        "mongodbUri",
        "connectionString",
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "*.secret",
        "*.password",
        "*.authorization",
        "*.signature",
        "*.token",
        "*.hmacSecret",
      ],
      censor: REDACTED,
    },

    formatters: {
      log(object) {
        const formatted = { ...object };

        for (const key of ["message", "msg"]) {
          if (typeof formatted[key] === "string") {
            formatted[key] = sanitize(formatted[key]);
          }
        }

        return formatted;
      },
    },
  });
}

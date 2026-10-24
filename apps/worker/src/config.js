import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const booleanString = (defaultValue = "false") =>
  z
    .enum(["true", "false", "1", "0"])
    .default(defaultValue)
    .transform((value) => value === "true" || value === "1");

const DEV_PROVIDER_SECRET = "dev-only-mock-provider-secret-change-me";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(4200),
  MONGODB_URI: z
    .string()
    .regex(
      /^mongodb\+srv:\/\//,
      "MONGODB_URI must be a MongoDB Atlas connection string",
    )
    .optional(),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(5000),
  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  MONGODB_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1000).default(45000),
  MONGODB_AUTO_INDEX: booleanString("true"),
  PROVIDER_BASE_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:4100/provider/alpha"),
  MOCK_PROVIDER_HMAC_SECRET: z.string().min(32).default(DEV_PROVIDER_SECRET),
});

export function loadWorkerConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
      )
      .join("; ");
    throw new Error(`Invalid worker configuration: ${issues}`);
  }

  if (!result.data.MONGODB_URI) {
    throw new Error(
      "Invalid worker configuration: MONGODB_URI is required (use the Atlas connection string)",
    );
  }

  if (
    result.data.NODE_ENV === "production" &&
    result.data.MOCK_PROVIDER_HMAC_SECRET === DEV_PROVIDER_SECRET
  ) {
    throw new Error(
      "Invalid worker configuration: MOCK_PROVIDER_HMAC_SECRET must be set to a unique secret in production",
    );
  }

  return Object.freeze({
    nodeEnv: result.data.NODE_ENV,
    logLevel: result.data.LOG_LEVEL,
    healthPort: result.data.WORKER_HEALTH_PORT,
    mongodbUri: result.data.MONGODB_URI,
    mongodbMaxPoolSize: result.data.MONGODB_MAX_POOL_SIZE,
    mongodbServerSelectionTimeoutMs:
      result.data.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    mongodbConnectTimeoutMs: result.data.MONGODB_CONNECT_TIMEOUT_MS,
    mongodbSocketTimeoutMs: result.data.MONGODB_SOCKET_TIMEOUT_MS,
    autoIndex: result.data.MONGODB_AUTO_INDEX,
    providerBaseUrl: result.data.PROVIDER_BASE_URL.replace(/\/$/, ""),
    mockProviderHmacSecret: result.data.MOCK_PROVIDER_HMAC_SECRET,
    service: Object.freeze({ name: "pratyaya-worker", version: "0.1.0" }),
  });
}

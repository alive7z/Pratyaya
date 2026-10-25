import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const DEV_PROVIDER_SECRET = "dev-only-mock-provider-secret-change-me";

const booleanString = (defaultValue = "false") =>
  z
    .enum(["true", "false", "1", "0"])
    .default(defaultValue)
    .transform((value) => value === "true" || value === "1");

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
    .min(1)
    .regex(
      /^mongodb(\+srv)?:\/\//,
      "MONGODB_URI must be a valid MongoDB connection string",
    ),

  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),

  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(5000),

  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),

  MONGODB_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1000).default(45000),

  MONGODB_AUTO_INDEX: booleanString("false"),

  PROVIDER_BASE_URL: z.string().url().default("http://127.0.0.1:4100"),

  PROVIDER_ID: z.enum(["alpha", "beta", "gamma"]).default("alpha"),

  MOCK_PROVIDER_HMAC_SECRET: z.string().min(32).default(DEV_PROVIDER_SECRET),

  WEBHOOK_DELIVERY_URL: z.string().url().optional(),

  WEBHOOK_SIGNING_SECRET: z.string().min(32).optional(),

  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
});

export function loadWorkerConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(
        (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
      )
      .join("; ");

    throw new Error(`Invalid worker configuration: ${issues}`);
  }

  const env = parsed.data;

  if (
    env.NODE_ENV === "production" &&
    env.MOCK_PROVIDER_HMAC_SECRET === DEV_PROVIDER_SECRET
  ) {
    throw new Error(
      "MOCK_PROVIDER_HMAC_SECRET must be configured securely in production",
    );
  }

  if (
    env.NODE_ENV === "production" &&
    new URL(env.PROVIDER_BASE_URL).protocol !== "https:"
  ) {
    throw new Error("PROVIDER_BASE_URL must use HTTPS in production");
  }

  if (
    Boolean(env.WEBHOOK_DELIVERY_URL) !== Boolean(env.WEBHOOK_SIGNING_SECRET)
  ) {
    throw new Error(
      "WEBHOOK_DELIVERY_URL and WEBHOOK_SIGNING_SECRET must be configured together",
    );
  }

  if (
    env.NODE_ENV === "production" &&
    env.WEBHOOK_DELIVERY_URL &&
    new URL(env.WEBHOOK_DELIVERY_URL).protocol !== "https:"
  ) {
    throw new Error("WEBHOOK_DELIVERY_URL must use HTTPS in production");
  }

  const providerBaseUrl = env.PROVIDER_BASE_URL.replace(/\/+$/, "");

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    healthPort: env.WORKER_HEALTH_PORT,

    mongodbUri: env.MONGODB_URI,
    mongodbMaxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    mongodbServerSelectionTimeoutMs: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    mongodbConnectTimeoutMs: env.MONGODB_CONNECT_TIMEOUT_MS,
    mongodbSocketTimeoutMs: env.MONGODB_SOCKET_TIMEOUT_MS,
    autoIndex: env.MONGODB_AUTO_INDEX,

    providerBaseUrl,
    providerId: env.PROVIDER_ID,
    mockProviderHmacSecret: env.MOCK_PROVIDER_HMAC_SECRET,
    webhookDeliveryUrl: env.WEBHOOK_DELIVERY_URL ?? null,
    webhookSigningSecret: env.WEBHOOK_SIGNING_SECRET ?? null,
    webhookTimeoutMs: env.WEBHOOK_TIMEOUT_MS,

    service: Object.freeze({
      name: "pratyaya-worker",
      version: "0.1.0",
    }),
  });
}

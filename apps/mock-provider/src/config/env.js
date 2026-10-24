import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

const booleanString = (defaultValue = "false") =>
  z
    .enum(["true", "false", "1", "0"])
    .default(defaultValue)
    .transform((value) => value === "true" || value === "1");

const faultRuleSchema = z
  .object({
    type: z.enum([
      "timeout",
      "decline",
      "latency",
      "error",
      "duplicate_webhook",
    ]),
    enabled: z.boolean().default(false),
    delayMs: z.coerce.number().int().min(0).max(60000).optional(),
    statusCode: z.coerce.number().int().min(400).max(599).optional(),
    code: z.string().trim().max(64).optional(),
    message: z.string().trim().max(240).optional(),
  })
  .strict();

const faultsSchema = z
  .object({
    enabled: z.boolean().default(false),
    rules: z.array(faultRuleSchema).max(10).default([]),
  })
  .strict();

const providerConfigSchema = z
  .object({
    providerId: z.enum(["alpha", "beta", "gamma"]),
    baseUrl: z.string().url(),
    hmacSecret: z.string().min(32),
    timeoutMs: z.coerce.number().int().min(1000).default(15000),
    retryAttempts: z.coerce.number().int().min(0).max(5).default(3),
    faults: faultsSchema.default({ enabled: false, rules: [] }),
    healthConfig: z
      .object({
        baseLatencyMs: z.coerce.number().int().min(0).default(50),
        latencyVarianceMs: z.coerce.number().int().min(0).default(20),
        failureProbability: z.coerce.number().min(0).max(1).default(0),
        timeoutProbability: z.coerce.number().min(0).max(1).default(0),
      })
      .optional(),
  })
  .strict();

const providersSchema = z.array(providerConfigSchema).min(1).max(3);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PROVIDER_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  PROVIDER_MONGODB_URI: z
    .string()
    .regex(
      /^mongodb\+srv:\/\//,
      "PROVIDER_MONGODB_URI must be a MongoDB Atlas connection string",
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
  PROVIDERS: z
    .string()
    .optional()
    .transform((val) => (val ? JSON.parse(val) : []))
    .pipe(providersSchema)
    .default([]),
  PROVIDER_FAULTS: z
    .string()
    .optional()
    .transform((val) => (val ? JSON.parse(val) : { enabled: false, rules: [] }))
    .pipe(faultsSchema)
    .default({ enabled: false, rules: [] }),
});

export function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
      )
      .join("; ");
    throw new Error(`Invalid mock-provider configuration: ${issues}`);
  }

  const env = result.data;

  if (!env.PROVIDER_MONGODB_URI) {
    throw new Error(
      "Invalid mock-provider configuration: PROVIDER_MONGODB_URI is required (use the Atlas connection string for the provider cluster)",
    );
  }

  if (env.PROVIDERS.length === 0) {
    throw new Error(
      "Invalid mock-provider configuration: At least one provider must be configured in PROVIDERS",
    );
  }

  const providerIds = env.PROVIDERS.map((p) => p.providerId);
  if (new Set(providerIds).size !== providerIds.length) {
    throw new Error("Duplicate provider IDs in PROVIDERS configuration");
  }

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    providerPort: env.PROVIDER_PORT,
    mongodb: Object.freeze({
      uri: env.PROVIDER_MONGODB_URI,
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      serverSelectionTimeoutMs: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMs: env.MONGODB_CONNECT_TIMEOUT_MS,
      socketTimeoutMs: env.MONGODB_SOCKET_TIMEOUT_MS,
      autoIndex: env.MONGODB_AUTO_INDEX,
    }),
    faults: Object.freeze(env.PROVIDER_FAULTS),
    providers: Object.freeze(env.PROVIDERS),
    service: Object.freeze({
      name: "pratyaya-mock-provider",
      version: packageJson.version,
    }),
  });
}

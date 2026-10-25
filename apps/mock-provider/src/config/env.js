import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

const DEV_PROVIDER_SECRET = "dev-only-mock-provider-secret-change-me";

const booleanString = (defaultValue = "false") =>
  z
    .enum(["true", "false", "1", "0"])
    .default(defaultValue)
    .transform((value) => value === "true" || value === "1");

const jsonEnv = (schema, fallback) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return fallback;

      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Must contain valid JSON",
        });
        return z.NEVER;
      }
    })
    .pipe(schema);

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
    providerId: z.enum(["alpha", "beta", "gamma", "all"]).optional(),
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

const providerSchema = z
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
      .strict()
      .optional(),
  })
  .strict();

const providersSchema = z
  .array(providerSchema)
  .min(1)
  .max(3)
  .refine(
    (providers) =>
      new Set(providers.map((provider) => provider.providerId)).size ===
      providers.length,
    { message: "Provider IDs must be unique" },
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  PROVIDER_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),

  PROVIDER_PUBLIC_URL: z.string().url().default("http://127.0.0.1:4100"),

  MOCK_PROVIDER_HMAC_SECRET: z.string().min(32).default(DEV_PROVIDER_SECRET),

  PROVIDER_MONGODB_URI: z
    .string()
    .regex(
      /^mongodb\+srv:\/\/[^/]+/i,
      "Must be a MongoDB Atlas connection string",
    )
    .min(1),

  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),

  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(5000),

  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),

  MONGODB_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1000).default(45000),

  MONGODB_AUTO_INDEX: booleanString("true"),

  PROVIDERS: jsonEnv(providersSchema.optional(), undefined),

  PROVIDER_FAULTS: jsonEnv(faultsSchema, {
    enabled: false,
    rules: [],
  }),
});

function validateProduction(env, providers) {
  if (env.NODE_ENV !== "production") return;

  if (
    env.PROVIDER_FAULTS.enabled ||
    providers.some((provider) => provider.faults?.enabled)
  ) {
    throw new Error("Provider fault injection must be disabled in production");
  }

  if (env.MOCK_PROVIDER_HMAC_SECRET === DEV_PROVIDER_SECRET) {
    throw new Error(
      "MOCK_PROVIDER_HMAC_SECRET must use a unique production secret",
    );
  }

  if (
    providers.some((provider) => provider.hmacSecret === DEV_PROVIDER_SECRET)
  ) {
    throw new Error(
      "Provider HMAC secrets must not use development credentials in production",
    );
  }

  const publicUrl = new URL(env.PROVIDER_PUBLIC_URL);

  if (publicUrl.protocol !== "https:") {
    throw new Error("PROVIDER_PUBLIC_URL must use HTTPS in production");
  }
}

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

  const publicUrl = env.PROVIDER_PUBLIC_URL.replace(/\/+$/, "");

  const providers =
    env.PROVIDERS ??
    ["alpha", "beta", "gamma"].map((providerId) => ({
      providerId,
      baseUrl: `${publicUrl}/provider/${providerId}`,
      hmacSecret: env.MOCK_PROVIDER_HMAC_SECRET,
      timeoutMs: 15000,
      retryAttempts: 3,
      faults: { enabled: false, rules: [] },
    }));

  validateProduction(env, providers);

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    providerPort: env.PORT ?? env.PROVIDER_PORT,

    mongodb: Object.freeze({
      uri: env.PROVIDER_MONGODB_URI,
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      serverSelectionTimeoutMs: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMs: env.MONGODB_CONNECT_TIMEOUT_MS,
      socketTimeoutMs: env.MONGODB_SOCKET_TIMEOUT_MS,
      autoIndex: env.MONGODB_AUTO_INDEX,
    }),

    faults: Object.freeze({
      enabled: env.PROVIDER_FAULTS.enabled,
      rules: Object.freeze(
        env.PROVIDER_FAULTS.rules.map((rule) => Object.freeze({ ...rule })),
      ),
    }),

    providers: Object.freeze(
      providers.map((provider) =>
        Object.freeze({
          ...provider,
          faults: Object.freeze({
            ...(env.PROVIDER_FAULTS.enabled
              ? env.PROVIDER_FAULTS
              : provider.faults),
            rules: Object.freeze(
              (env.PROVIDER_FAULTS.enabled
                ? env.PROVIDER_FAULTS.rules
                : provider.faults.rules
              ).map((rule) => Object.freeze({ ...rule })),
            ),
          }),
          ...(provider.healthConfig && {
            healthConfig: Object.freeze({ ...provider.healthConfig }),
          }),
        }),
      ),
    ),

    service: Object.freeze({
      name: "pratyaya-mock-provider",
      version,
    }),
  });
}

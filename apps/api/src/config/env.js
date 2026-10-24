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

const optionalBooleanString = () =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true" || value === "1",
    );

const DEV_JWT_SECRET = "dev-only-pratyaya-jwt-secret-change-me-0001";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  TRUST_PROXY: booleanString(),
  REQUEST_BODY_LIMIT: z.string().default("32kb"),
  MONGODB_URI: z
    .string()
    .regex(
      /^mongodb\+srv:\/\//,
      "MONGODB_URI must be a MongoDB Atlas connection string",
    )
    .optional(),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().int().min(0).max(20).default(0),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(5000),
  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  MONGODB_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1000).default(45000),
  MONGODB_AUTO_INDEX: booleanString("true"),
  AUTH_JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
  AUTH_ISSUER: z.string().default("pratyaya-api"),
  AUTH_AUDIENCE: z.string().default("pratyaya-web"),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(900),
  AUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(31_536_000)
    .default(604_800),
  COOKIE_SECURE: optionalBooleanString(),
  DEMO_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(86_400)
    .default(7200),
  DEMO_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900_000),
  DEMO_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
  DEMO_MAX_ACTIVE_SESSIONS_PER_IP: z.coerce.number().int().min(1).default(10),
  DEMO_AUTO_SEED: booleanString("true"),
});

export function parseConfig(environment) {
  const result = envSchema.safeParse(environment);

  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
      )
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const env = result.data;

  if (!env.MONGODB_URI) {
    throw new Error(
      "Invalid environment configuration: MONGODB_URI is required (use the Atlas connection string from your environment or untracked .env)",
    );
  }

  if (env.NODE_ENV === "production" && env.AUTH_JWT_SECRET === DEV_JWT_SECRET) {
    throw new Error(
      "Invalid environment configuration: AUTH_JWT_SECRET must be set to a unique secret in production",
    );
  }

  const secureCookies =
    env.COOKIE_SECURE === undefined
      ? env.NODE_ENV === "production"
      : env.COOKIE_SECURE;

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    apiPort: env.API_PORT,
    corsOrigins: Object.freeze(env.CORS_ORIGINS),
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    trustProxy: env.TRUST_PROXY,
    requestBodyLimit: env.REQUEST_BODY_LIMIT,
    mongodb: Object.freeze({
      uri: env.MONGODB_URI,
      appName: "pratyaya-api",
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      minPoolSize: env.MONGODB_MIN_POOL_SIZE,
      serverSelectionTimeoutMs: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMs: env.MONGODB_CONNECT_TIMEOUT_MS,
      socketTimeoutMs: env.MONGODB_SOCKET_TIMEOUT_MS,
      autoIndex: env.MONGODB_AUTO_INDEX,
    }),
    auth: Object.freeze({
      jwtSecret: env.AUTH_JWT_SECRET,
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE,
      accessTokenTtlSeconds: env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlSeconds: env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
      secureCookies,
    }),
    demo: Object.freeze({
      sessionTtlSeconds: env.DEMO_SESSION_TTL_SECONDS,
      rateLimitWindowMs: env.DEMO_RATE_LIMIT_WINDOW_MS,
      rateLimitMax: env.DEMO_RATE_LIMIT_MAX,
      maxActiveSessionsPerIp: env.DEMO_MAX_ACTIVE_SESSIONS_PER_IP,
      autoSeed: env.DEMO_AUTO_SEED,
    }),
    service: Object.freeze({
      name: "pratyaya-api",
      version: packageJson.version,
    }),
  });
}

export function loadConfig() {
  return parseConfig(process.env);
}

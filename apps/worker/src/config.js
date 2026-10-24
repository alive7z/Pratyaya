import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

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
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(5000),
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

  return Object.freeze({
    nodeEnv: result.data.NODE_ENV,
    logLevel: result.data.LOG_LEVEL,
    healthPort: result.data.WORKER_HEALTH_PORT,
    mongodbUri: result.data.MONGODB_URI,
    mongodbServerSelectionTimeoutMs:
      result.data.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    service: Object.freeze({ name: "pratyaya-worker", version: "0.1.0" }),
  });
}

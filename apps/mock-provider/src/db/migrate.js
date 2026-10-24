import pino from "pino";
import { migrateProviderOperationIndexes } from "../../migrations/001-provider-operation-indexes.js";
import { loadConfig } from "../config/env.js";
import { connectMongo, disconnectMongo } from "./mongoose.js";

const config = loadConfig();
const logger = pino({ level: config.logLevel });

try {
  await connectMongo(config.mongodb, logger);
  await migrateProviderOperationIndexes(logger);
  logger.info(
    { event: "provider.migration.complete" },
    "Provider migrations completed",
  );
} catch (error) {
  logger.error(
    { event: "provider.migration.failed", err: error },
    "Provider migration failed",
  );
  process.exitCode = 1;
} finally {
  await disconnectMongo();
}


import { migrateProviderOperationIndexes } from "../../migrations/001-provider-operation-indexes.js";
import { loadConfig } from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { connectMongo, disconnectMongo } from "./mongoose.js";

const config = loadConfig();

const logger = createLogger({
  level: config.logLevel,
  service: "pratyaya-provider-migrations",
});

async function main() {
  try {
    await connectMongo(config.mongodb, logger, {
      initializeModels: false,
    });

    await migrateProviderOperationIndexes(logger);

    logger.info(
      { event: "provider.migration.complete" },
      "Provider migrations completed successfully",
    );
  } catch (error) {
    logger.error(
      { event: "provider.migration.failed", err: error },
      "Provider migration failed",
    );

    process.exitCode = 1;
  } finally {
    try {
      await disconnectMongo();
    } catch (error) {
      logger.error(
        { event: "provider.mongodb.disconnect.failed", err: error },
        "Failed to disconnect from MongoDB",
      );

      process.exitCode = 1;
    }
  }
}

await main();

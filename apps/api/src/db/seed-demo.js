import { loadConfig } from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { connectMongo, disconnectMongo } from "./mongoose.js";
import { runDemoSeed } from "../modules/demo/demo.seed.js";

const config = loadConfig();
const logger = createLogger({
  level: config.logLevel,
  service: config.service.name,
});

try {
  await connectMongo(config.mongodb, logger);
  const result = await runDemoSeed({ force: true, logger });
  logger.info(
    {
      event: "demo.seed.cli.completed",
      seeded: result.seeded,
      version: result.version,
    },
    "Demo seed command completed",
  );
} catch (error) {
  logger.fatal(
    { event: "demo.seed.cli.failed", err: error },
    "Demo seed command failed",
  );
  process.exitCode = 1;
} finally {
  await disconnectMongo();
}

import { createProviderApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { connectMongo, disconnectMongo, pingMongo } from "./db/mongoose.js";

const config = loadConfig();
const logger = createLogger({
  level: config.logLevel,
  service: config.service.name,
});
let connection;
try {
  connection = await connectMongo(config.mongodb, logger);
} catch (error) {
  logger.fatal(
    { event: "provider.start_failed", err: error },
    "Mock provider failed to connect to MongoDB Atlas",
  );
  process.exit(1);
}
const database = { ping: () => pingMongo(connection) };
const app = createProviderApp({ database, config, logger });

const server = app.listen(config.providerPort, "0.0.0.0", () => {
  logger.info(
    {
      event: "provider.started",
      port: config.providerPort,
      nodeEnv: config.nodeEnv,
      version: config.service.version,
    },
    "Mock payment provider listening",
  );
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(
    { event: "provider.shutdown", signal },
    "Shutting down mock provider",
  );

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  await new Promise((resolve) => {
    server.close(resolve);
  });
  await disconnectMongo();

  clearTimeout(forceExit);
  logger.info({ event: "provider.stopped" }, "Mock provider stopped");
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.fatal(
    { event: "process.unhandledRejection", err: reason },
    "Unhandled rejection",
  );
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.fatal(
    { event: "process.uncaughtException", err: error },
    "Uncaught exception",
  );
  process.exit(1);
});

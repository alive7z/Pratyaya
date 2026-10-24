import { loadConfig } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import {
  connectMongo,
  disconnectMongo,
  mongoStatus,
  pingMongo,
} from "./db/mongoose.js";
import { createApp } from "./app.js";

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
    { event: "api.start_failed", err: error },
    "Pratyaya API failed to connect to MongoDB Atlas",
  );
  process.exit(1);
}
const database = {
  ping: () => pingMongo(connection),
  status: () => mongoStatus(connection),
};
const app = createApp({ database, config, logger });

const server = app.listen(config.apiPort, () => {
  logger.info(
    {
      event: "api.started",
      port: config.apiPort,
      nodeEnv: config.nodeEnv,
      version: config.service.version,
    },
    "Pratyaya API listening",
  );
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ event: "api.shutdown", signal }, "Shutting down Pratyaya API");

  const forceExit = setTimeout(() => {
    logger.fatal(
      { event: "api.shutdown.forced" },
      "Graceful shutdown timed out",
    );
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise((resolve) => {
    server.close(resolve);
  });

  await disconnectMongo();

  clearTimeout(forceExit);
  logger.info({ event: "api.stopped" }, "Pratyaya API stopped");
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

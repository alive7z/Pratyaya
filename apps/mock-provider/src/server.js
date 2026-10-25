import { createProviderApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { connectMongo, disconnectMongo, pingMongo } from "./db/mongoose.js";

const config = loadConfig();

const logger = createLogger({
  level: config.logLevel,
  service: config.service.name,
});

let server;
let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(
    { event: "provider.shutdown", signal },
    "Shutting down mock provider",
  );

  const forceExit = setTimeout(() => {
    logger.fatal(
      { event: "provider.shutdown.timeout" },
      "Provider shutdown exceeded 10 seconds",
    );
    process.exit(1);
  }, 10000);

  forceExit.unref();

  try {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });

        server.closeIdleConnections?.();
      });
    }

    await disconnectMongo();

    logger.info(
      { event: "provider.stopped" },
      "Mock provider stopped successfully",
    );
  } catch (error) {
    exitCode = 1;

    logger.error(
      { event: "provider.shutdown.failed", err: error },
      "Mock provider shutdown failed",
    );
  } finally {
    clearTimeout(forceExit);
    process.exitCode = exitCode;
  }
}

async function start() {
  try {
    const connection = await connectMongo(config.mongodb, logger);

    await pingMongo(connection);

    const database = {
      ping: () => pingMongo(connection),
    };

    const app = createProviderApp({
      database,
      config,
      logger,
    });

    server = app.listen(config.providerPort, "0.0.0.0", () => {
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

    server.on("error", (error) => {
      logger.fatal(
        { event: "provider.server.error", err: error },
        "Mock provider HTTP server failed",
      );

      void shutdown("SERVER_ERROR", 1);
    });
  } catch (error) {
    logger.fatal(
      { event: "provider.start.failed", err: error },
      "Mock provider startup failed",
    );

    await shutdown("STARTUP_FAILURE", 1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.fatal(
    { event: "process.unhandled_rejection", err: reason },
    "Unhandled promise rejection",
  );

  void shutdown("UNHANDLED_REJECTION", 1);
});

process.on("uncaughtException", (error) => {
  logger.fatal(
    { event: "process.uncaught_exception", err: error },
    "Uncaught exception",
  );

  void shutdown("UNCAUGHT_EXCEPTION", 1);
});

await start();

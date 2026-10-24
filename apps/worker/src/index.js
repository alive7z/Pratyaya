import { createServer } from "node:http";
import mongoose from "mongoose";
import { loadWorkerConfig } from "./config.js";
import { createLogger } from "./logger.js";

mongoose.set("bufferCommands", false);

const config = loadWorkerConfig();
const logger = createLogger({
  level: config.logLevel,
  service: config.service.name,
});

let shuttingDown = false;

async function pingMongo(timeoutMs = 2000) {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error("MongoDB is not connected");
  }

  let timeout;
  try {
    await Promise.race([
      mongoose.connection.db.admin().command({ ping: 1 }),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("MongoDB ping timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health/live") {
    sendJson(res, 200, {
      status: "ok",
      service: config.service.name,
      version: config.service.version,
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health/ready") {
    try {
      await pingMongo();
      sendJson(res, 200, {
        status: "ready",
        service: config.service.name,
        checks: { database: { status: "up" } },
      });
    } catch {
      sendJson(res, 503, {
        status: "not_ready",
        service: config.service.name,
        checks: { database: { status: "down", code: "DATABASE_UNAVAILABLE" } },
      });
    }
    return;
  }

  sendJson(res, 404, {
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(
    { event: "worker.shutdown", signal },
    "Shutting down Pratyaya worker",
  );

  const forceExit = setTimeout(() => {
    logger.fatal(
      { event: "worker.shutdown.forced" },
      "Graceful shutdown timed out",
    );
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  clearTimeout(forceExit);
  logger.info({ event: "worker.stopped" }, "Pratyaya worker stopped");
  process.exit(0);
}

async function start() {
  await mongoose.connect(config.mongodbUri, {
    appName: config.service.name,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: config.mongodbServerSelectionTimeoutMs,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    autoIndex: false,
  });

  server.listen(config.healthPort, () => {
    logger.info(
      {
        event: "worker.started",
        nodeEnv: config.nodeEnv,
        healthPort: config.healthPort,
      },
      "Pratyaya worker foundation is ready. No job processors are registered yet.",
    );
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
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

start().catch((error) => {
  logger.fatal(
    {
      event: "worker.start_failed",
      errorName: error.name,
      message: String(error.message).replace(
        /mongodb(?:\+srv)?:\/\/[^\s"']+/gi,
        "[REDACTED_MONGODB_URI]",
      ),
    },
    "Worker failed to start",
  );
  process.exit(1);
});

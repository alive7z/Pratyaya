import express from "express";
import helmet from "helmet";
import pino from "pino";
import mongoose from "mongoose";
import { withTimeout } from "./lib/async.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { validate } from "../../../api/src/middleware/validate.js";
import providerOperationRoutes from "./modules/operations/provider-operation.routes.js";

const silentLogger = pino({ enabled: false });

function meta(requestIdValue) {
  return {
    requestId: requestIdValue,
    timestamp: new Date().toISOString(),
  };
}

async function checkDatabase(database) {
  const startedAt = performance.now();

  try {
    await withTimeout(database.ping(), 2000, "provider database");
    return {
      status: "up",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    return {
      status: "down",
      latencyMs: Math.round(performance.now() - startedAt),
      code: "PROVIDER_DATABASE_UNAVAILABLE",
    };
  }
}

function mongooseSessionMiddleware() {
  return async (req, res, next) => {
    const session = await mongoose.startSession();
    req.mongooseSession = session;
    try {
      await session.withTransaction(async () => {
        await next();
      });
    } finally {
      await session.endSession();
    }
  };
}

export function createProviderApp({ database, config, logger = silentLogger }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));

  app.locals.config = config;

  app.get("/", (req, res) => {
    res.json({
      data: {
        service: config.service.name,
        version: config.service.version,
        simulationOnly: true,
      },
      meta: meta(req.requestId),
    });
  });

  app.get("/health/live", (req, res) => {
    res.json({
      data: {
        status: "ok",
        service: config.service.name,
        version: config.service.version,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      meta: meta(req.requestId),
    });
  });

  app.get("/health/ready", async (req, res) => {
    const databaseCheck = await checkDatabase(database);
    const ready = databaseCheck.status === "up";

    res.status(ready ? 200 : 503).json({
      data: {
        status: ready ? "ready" : "not_ready",
        service: config.service.name,
        version: config.service.version,
        checks: { database: databaseCheck },
        timestamp: new Date().toISOString(),
      },
      meta: meta(req.requestId),
    });
  });

  app.use(mongooseSessionMiddleware());

  app.use("/provider", providerOperationRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: `No route matches ${req.method} ${req.path}`,
      },
      meta: meta(req.requestId),
    });
  });

  app.use((error, req, res, _next) => {
    if (res.headersSent) return;

    const isParseError = error?.type === "entity.parse.failed";
    const statusCode = isParseError ? 400 : 500;
    const code = isParseError ? "INVALID_JSON" : "INTERNAL_ERROR";
    const message = isParseError
      ? "Request body is not valid JSON"
      : "Unexpected provider error";

    if (statusCode >= 500) {
      logger.error(
        { event: "provider.error", requestId: req.requestId, err: error },
        "Mock provider request failed",
      );
    }

    res.status(statusCode).json({
      error: { code, message },
      meta: meta(req.requestId),
    });
  });

  return app;
}

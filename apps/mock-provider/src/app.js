import express from "express";
import helmet from "helmet";
import pino from "pino";
import { withTimeout } from "./lib/async.js";
import { AppError } from "./lib/errors.js";
import { authenticateProvider } from "./middleware/authenticateProvider.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
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

function providerConfigMiddleware(providers) {
  return (req, res, next) => {
    const providerId =
      req.params.providerId ||
      req.query.providerId ||
      req.headers["x-provider-id"];
    if (!providerId) {
      return res.status(400).json({
        error: {
          code: "PROVIDER_ID_REQUIRED",
          message:
            "Provider ID is required (providerId param, query, or x-provider-id header)",
        },
        meta: meta(req.requestId),
      });
    }
    const provider = providers.find((p) => p.providerId === providerId);
    if (!provider) {
      return res.status(404).json({
        error: {
          code: "PROVIDER_NOT_FOUND",
          message: `Provider ${providerId} not found`,
        },
        meta: meta(req.requestId),
      });
    }
    req.providerConfig = provider;
    next();
  };
}

export function createProviderApp({ database, config, logger = silentLogger }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(helmet());
  app.use(
    express.json({
      limit: "32kb",
      verify(req, _res, buffer) {
        req.rawBody = Buffer.from(buffer);
      },
    }),
  );

  app.locals.config = config;

  app.get("/", (req, res) => {
    res.json({
      data: {
        service: config.service.name,
        version: config.service.version,
        simulationOnly: true,
        providers: config.providers.map((p) => ({
          providerId: p.providerId,
          baseUrl: p.baseUrl,
        })),
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

  app.get("/providers", (req, res) => {
    res.json({
      data: {
        providers: config.providers.map((p) => ({
          providerId: p.providerId,
          baseUrl: p.baseUrl,
          healthConfig: p.healthConfig,
        })),
      },
      meta: meta(req.requestId),
    });
  });

  app.use(
    "/provider/:providerId",
    providerConfigMiddleware(config.providers),
    authenticateProvider,
    providerOperationRoutes,
  );

  app.use(
    "/provider",
    providerConfigMiddleware(config.providers),
    authenticateProvider,
    providerOperationRoutes,
  );

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
    const isOperational = error instanceof AppError;
    const statusCode = isParseError
      ? 400
      : isOperational
        ? error.statusCode
        : 500;
    const code = isParseError
      ? "INVALID_JSON"
      : isOperational
        ? error.code
        : "INTERNAL_ERROR";
    const message = isParseError
      ? "Request body is not valid JSON"
      : isOperational
        ? error.message
        : "Unexpected provider error";

    if (statusCode >= 500) {
      logger.error(
        { event: "provider.error", requestId: req.requestId, err: error },
        "Mock provider request failed",
      );
    }

    res.status(statusCode).json({
      error: {
        code,
        message,
        ...(isOperational && error.details ? { details: error.details } : {}),
      },
      meta: meta(req.requestId),
    });
  });

  return app;
}

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
    await withTimeout(
      Promise.resolve().then(() => database.ping()),
      2000,
      "provider database",
    );

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

function providerConfigMiddleware(providers, allowRequestFaults) {
  const providerMap = new Map(
    providers.map((provider) => [provider.providerId, provider]),
  );

  return (req, _res, next) => {
    const candidates = [
      req.params.providerId,
      req.query.providerId,
      req.get("X-Provider-ID"),
    ].filter((value) => value !== undefined);

    if (candidates.length === 0) {
      return next(
        new AppError(400, "PROVIDER_ID_REQUIRED", "A provider ID is required"),
      );
    }

    if (
      candidates.some(
        (value) => typeof value !== "string" || value !== candidates[0],
      )
    ) {
      return next(
        new AppError(
          400,
          "PROVIDER_ID_MISMATCH",
          "Conflicting provider identifiers",
        ),
      );
    }

    const provider = providerMap.get(candidates[0]);

    if (!provider) {
      return next(
        new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found"),
      );
    }

    req.providerConfig = { ...provider, allowRequestFaults };
    return next();
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
      strict: true,
      verify(req, _res, buffer) {
        req.rawBody = Buffer.from(buffer);
      },
    }),
  );

  app.locals.config = config;

  app.get("/", (req, res) => {
    return res.json({
      data: {
        service: config.service.name,
        version: config.service.version,
        simulationOnly: true,
        providers: config.providers.map(({ providerId, baseUrl }) => ({
          providerId,
          baseUrl,
        })),
      },
      meta: meta(req.requestId),
    });
  });

  app.get("/health/live", (req, res) => {
    return res.json({
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

  app.get("/health/ready", async (req, res, next) => {
    try {
      const databaseCheck = await checkDatabase(database);
      const ready = databaseCheck.status === "up";

      return res.status(ready ? 200 : 503).json({
        data: {
          status: ready ? "ready" : "not_ready",
          service: config.service.name,
          version: config.service.version,
          checks: {
            database: databaseCheck,
          },
          timestamp: new Date().toISOString(),
        },
        meta: meta(req.requestId),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/providers", (req, res) => {
    return res.json({
      data: {
        providers: config.providers.map(
          ({ providerId, baseUrl, healthConfig }) => ({
            providerId,
            baseUrl,
            ...(healthConfig ? { healthConfig } : {}),
          }),
        ),
      },
      meta: meta(req.requestId),
    });
  });

  const resolveProvider = providerConfigMiddleware(
    config.providers,
    config.nodeEnv !== "production",
  );

  app.use(
    "/provider/:providerId",
    resolveProvider,
    authenticateProvider,
    providerOperationRoutes,
  );

  app.use(
    "/provider",
    resolveProvider,
    authenticateProvider,
    providerOperationRoutes,
  );

  app.use((req, _res, next) => {
    return next(
      new AppError(
        404,
        "NOT_FOUND",
        `No route matches ${req.method} ${req.path}`,
      ),
    );
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const isParseError = error?.type === "entity.parse.failed";
    const isBodyTooLarge = error?.type === "entity.too.large";
    const isUnsupportedEncoding = error?.type === "encoding.unsupported";
    const isOperational = error instanceof AppError;

    const statusCode = isParseError
      ? 400
      : isBodyTooLarge
        ? 413
        : isUnsupportedEncoding
          ? 415
          : isOperational
            ? error.statusCode
            : 500;

    const code = isParseError
      ? "INVALID_JSON"
      : isBodyTooLarge
        ? "PAYLOAD_TOO_LARGE"
        : isUnsupportedEncoding
          ? "UNSUPPORTED_ENCODING"
          : isOperational
            ? error.code
            : "INTERNAL_ERROR";

    const message = isParseError
      ? "Request body is not valid JSON"
      : isBodyTooLarge
        ? "Request body exceeds the allowed size"
        : isUnsupportedEncoding
          ? "Request content encoding is not supported"
          : isOperational && statusCode < 500
            ? error.message
            : "Unexpected provider error";

    if (statusCode >= 500) {
      logger.error(
        {
          event: "provider.error",
          requestId: req.requestId,
          err: error,
        },
        "Mock provider request failed",
      );
    }

    return res.status(statusCode).json({
      error: {
        code,
        message,
        ...(isOperational && statusCode < 500 && error.details
          ? { details: error.details }
          : {}),
      },
      meta: meta(req.requestId),
    });
  });

  return app;
}

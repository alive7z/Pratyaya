import { readFileSync } from "node:fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import swaggerUi from "swagger-ui-express";
import { parse as parseYaml } from "yaml";
import { AppError } from "./lib/errors.js";
import { sendData } from "./lib/response.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { createApiRateLimiter } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { createAuditRouter } from "./modules/audit/audit.routes.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createDashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { createDemoRouter } from "./modules/demo/demo.routes.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createLedgerRouter } from "./modules/ledger/ledger.routes.js";
import { createPaymentRouter } from "./modules/payments/payment.routes.js";
import { createReconciliationRouter } from "./modules/reconciliation/reconciliation.routes.js";
import { createRiskRouter } from "./modules/risk/risk.routes.js";
import { createRoutingRouter } from "./modules/routing/routing.routes.js";
import { createSandboxRouter } from "./modules/sandbox/sandbox.routes.js";
import { createAgentPayRouter } from "./modules/agentpay/agentpay.routes.js";
import { createSystemRouter } from "./modules/system/system.routes.js";
import { createWebhookRouter } from "./modules/webhooks/webhook.routes.js";

const openApiDocument = parseYaml(
  readFileSync(new URL("../../../docs/openapi.yaml", import.meta.url), "utf8"),
);

const silentLogger = pino({ enabled: false });

export function createApp({ database, config, logger = silentLogger }) {
  const app = express();
  app.locals.config = config;
  app.locals.logger = logger;
  app.locals.database = database;

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy ? 1 : false);

  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      credentials: true,
      maxAge: 600,
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new AppError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed"),
        );
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Idempotency-Key",
        "X-Request-ID",
        "X-CSRF-Token",
      ],
      exposedHeaders: ["X-Request-ID", "RateLimit", "RateLimit-Policy"],
    }),
  );
  app.use(express.json({ limit: config.requestBodyLimit }));

  app.get("/", (req, res) => {
    sendData(req, res, {
      service: config.service.name,
      version: config.service.version,
      documentation: "/api-docs",
      liveness: "/api/v1/health/live",
      readiness: "/api/v1/health/ready",
    });
  });

  app.use("/api/v1", createApiRateLimiter(config));

  app.use("/api/v1/health", createHealthRouter({ database, config }));

  app.use("/api/v1/system", createSystemRouter({ config, database }));

  app.use("/api/v1/auth", createAuthRouter({ config }));

  app.use("/api/v1/demo", createDemoRouter({ config }));

  app.use("/api/v1/dashboard", createDashboardRouter({ config }));

  app.use("/api/v1/payments", createPaymentRouter({ config }));

  app.use("/api/v1/ledger", createLedgerRouter({ config }));

  app.use("/api/v1/reconciliation", createReconciliationRouter({ config }));

  app.use("/api/v1/risk", createRiskRouter({ config }));

  app.use("/api/v1/audit-logs", createAuditRouter({ config }));

  app.use("/api/v1/webhooks", createWebhookRouter({ config }));

  app.use("/api/v1/routing", createRoutingRouter({ config }));

  app.use("/api/v1/sandbox", createSandboxRouter({ config }));

  app.use("/api/v1/agentpay", createAgentPayRouter({ config }));

  app.get("/api-docs/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Pratyaya API",
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}

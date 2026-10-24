import { Router } from "express";
import { withTimeout } from "../../lib/async.js";
import { sendData } from "../../lib/response.js";

const DEPENDENCY_TIMEOUT_MS = 2000;

async function checkDependency(name, runCheck) {
  const startedAt = performance.now();

  try {
    await withTimeout(
      Promise.resolve().then(runCheck),
      DEPENDENCY_TIMEOUT_MS,
      name,
    );
    return {
      status: "up",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    return {
      status: "down",
      latencyMs: Math.round(performance.now() - startedAt),
      code: name === "database" ? "DATABASE_UNAVAILABLE" : "REDIS_UNAVAILABLE",
    };
  }
}

export function createHealthRouter({ database, config }) {
  const router = Router();

  router.get("/live", (req, res) => {
    sendData(req, res, {
      status: "ok",
      service: config.service.name,
      version: config.service.version,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/ready", async (req, res) => {
    const checks = {
      database: await checkDependency("database", () => database.ping()),
    };

    const ready = Object.values(checks).every((check) => check.status === "up");

    sendData(
      req,
      res,
      {
        status: ready ? "ready" : "not_ready",
        service: config.service.name,
        version: config.service.version,
        checks,
        timestamp: new Date().toISOString(),
      },
      ready ? 200 : 503,
    );
  });

  return router;
}

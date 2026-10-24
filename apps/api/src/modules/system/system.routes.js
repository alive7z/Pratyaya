import { Router } from "express";
import { sendData } from "../../lib/response.js";

export function createSystemRouter({ config, database }) {
  const router = Router();

  router.get("/info", (req, res) => {
    sendData(req, res, {
      service: config.service.name,
      version: config.service.version,
      environment: config.nodeEnv,
      runtime: {
        name: "node",
        version: process.versions.node,
      },
      database: {
        engine: "mongodb",
        status: database.status(),
        transactionsRequireReplicaSet: true,
      },
      milestone: "M04_LEDGER_INTEGRITY",
      simulationOnly: true,
      implementedCapabilities: [
        "health",
        "system-info",
        "authentication",
        "refresh-rotation",
        "rbac",
        "demo-sessions",
        "role-dashboards",
        "audit-log-read",
        "payment-api-foundation",
        "double-entry-ledger",
        "derived-ledger-balances",
        "ledger-integrity-guardian",
        "synthetic-reconciliation-read",
      ],
      unavailableCapabilities: [
        "payment-execution",
        "reliability-lab",
        "live-provider-reconciliation",
        "agentpay",
        "live-analytics",
      ],
    });
  });

  return router;
}

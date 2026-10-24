import { Router } from "express";
import { PERMISSIONS } from "@pratyaya/shared";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requireDemoSandbox } from "../../middleware/authorize.js";
import { admin, developer, merchant, risk } from "./dashboard.controller.js";

export function createDashboardRouter({ config }) {
  const router = Router();
  const requireAuth = authenticate({ config });

  router.get(
    "/merchant",
    requireAuth,
    authorize(PERMISSIONS.MERCHANT_DASHBOARD_READ),
    merchant,
  );

  router.get(
    "/admin",
    requireAuth,
    authorize(PERMISSIONS.ADMIN_DASHBOARD_READ),
    requireDemoSandbox,
    admin,
  );

  router.get(
    "/developer",
    requireAuth,
    authorize(PERMISSIONS.DEVELOPER_DASHBOARD_READ),
    developer,
  );

  router.get(
    "/risk",
    requireAuth,
    authorize(PERMISSIONS.RISK_DASHBOARD_READ),
    risk,
  );

  return router;
}

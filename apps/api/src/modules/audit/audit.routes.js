import { Router } from "express";
import { PERMISSIONS } from "@pratyaya/shared";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { sendData } from "../../lib/response.js";
import { listAuditLogs } from "../dashboard/dashboard.service.js";

export function createAuditRouter({ config }) {
  const router = Router();
  const requireAuth = authenticate({ config });
  const canReadAudit = authorize(PERMISSIONS.AUDIT_READ);

  router.get(
    "/",
    requireAuth,
    (req, res, next) => {
      if (
        req.auth.permissions.includes(PERMISSIONS.AUDIT_READ) ||
        req.auth.permissions.includes(PERMISSIONS.AUDIT_READ_OWN)
      ) {
        return next();
      }
      return canReadAudit(req, res, next);
    },
    async (req, res, next) => {
      try {
        const limit = Number.parseInt(req.query.limit, 10) || 50;
        sendData(req, res, await listAuditLogs(req.auth, { limit }), 200);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

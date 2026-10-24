import { Router } from "express";
import { demoSessionRequestSchema } from "@pratyaya/shared";
import { createDemoSessionRateLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { createSession, listDemoRoles } from "./demo.controller.js";

export function createDemoRouter({ config }) {
  const router = Router();
  const demoLimiter = createDemoSessionRateLimiter(config);

  router.get("/roles", listDemoRoles);

  router.post(
    "/session",
    demoLimiter,
    validate({ body: demoSessionRequestSchema }),
    createSession,
  );

  return router;
}

import { Router } from "express";
import { loginSchema, registerSchema } from "@pratyaya/shared";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { createAuthRateLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { login, logout, me, refresh, register } from "./auth.controller.js";

export function createAuthRouter({ config }) {
  const router = Router();
  const authLimiter = createAuthRateLimiter(config);
  const requireAuth = authenticate({ config });

  router.post(
    "/register",
    authLimiter,
    validate({ body: registerSchema }),
    register,
  );

  router.post("/login", authLimiter, validate({ body: loginSchema }), login);

  router.post("/refresh", requireCsrf, refresh);

  router.post("/logout", requireCsrf, logout);

  router.get("/me", requireAuth, me);

  return router;
}

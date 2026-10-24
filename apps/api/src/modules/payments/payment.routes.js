import { Router } from "express";
import { PERMISSIONS, paymentCreateSchema } from "@pratyaya/shared";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import {
  cancel,
  create,
  get,
  list,
  summary,
  timeline,
} from "./payment.controller.js";

const paymentIdSchema = z.object({
  paymentId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid payment ID"),
});

const paymentListQuerySchema = z
  .object({
    status: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export function createPaymentRouter({ config }) {
  const router = Router();
  const requireAuth = authenticate({ config });

  router.get(
    "/summary",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    summary,
  );

  router.get(
    "/",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    validate({ query: paymentListQuerySchema }),
    list,
  );

  router.post(
    "/",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ body: paymentCreateSchema }),
    create,
  );

  router.get(
    "/:paymentId",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    validate({ params: paymentIdSchema }),
    get,
  );

  router.get(
    "/:paymentId/timeline",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    validate({ params: paymentIdSchema }),
    timeline,
  );

  router.post(
    "/:paymentId/cancel",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CANCEL),
    requireCsrf,
    validate({ params: paymentIdSchema }),
    cancel,
  );

  return router;
}

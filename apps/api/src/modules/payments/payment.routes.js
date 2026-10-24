import { Router } from "express";
import { PERMISSIONS, paymentCreateSchema } from "@pratyaya/shared";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import {
  cancel,
  capture,
  create,
  get,
  getAttempts,
  list,
  summary,
  timeline,
} from "./payment.controller.js";
import refundRoutes from "./refund.routes.js";

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

const captureSchema = z
  .object({
    amountMinor: z
      .string()
      .regex(
        /^(0|[1-9]\d*)$/,
        "amountMinor must be a positive integer digit string",
      )
      .refine(
        (v) => BigInt(v) > 0n && BigInt(v) <= 1_000_000_000_000n,
        "Amount out of range",
      )
      .optional(),
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

  router.get(
    "/:paymentId/attempts",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    validate({ params: paymentIdSchema }),
    getAttempts,
  );

  router.post(
    "/:paymentId/capture",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ params: paymentIdSchema, body: captureSchema }),
    capture,
  );

  router.post(
    "/:paymentId/cancel",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CANCEL),
    requireCsrf,
    validate({ params: paymentIdSchema }),
    cancel,
  );

  router.use("/:paymentId/refunds", refundRoutes);
  router.use("/refunds", refundRoutes);

  return router;
}

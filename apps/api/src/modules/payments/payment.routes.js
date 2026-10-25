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
import { createRefundRouter } from "./refund.routes.js";

const paymentIdSchema = z
  .object({
    paymentId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid payment ID"),
  })
  .strict();

const paymentListQuerySchema = z
  .object({
    status: z
      .enum([
        "CREATED",
        "QUEUED",
        "AUTHORIZING",
        "AUTHORIZED",
        "CAPTURING",
        "CAPTURED",
        "REFUND_PENDING",
        "PARTIALLY_REFUNDED",
        "REFUNDED",
        "FAILED",
        "CANCELLED",
        "UNKNOWN",
      ])
      .optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine(({ from, to }) => !from || !to || new Date(from) <= new Date(to), {
    message: "from must be earlier than or equal to to",
    path: ["to"],
  });

const captureSchema = z
  .object({
    amountMinor: z
      .string()
      .regex(/^[1-9]\d*$/, "Amount must be a positive integer")
      .refine(
        (value) => BigInt(value) <= 1_000_000_000_000n,
        "Amount exceeds the maximum allowed value",
      )
      .optional(),
  })
  .strict();

export function createPaymentRouter({ config }) {
  const router = Router();
  const requireAuth = authenticate({ config });

  router.use(createRefundRouter({ config }));

  router.get(
    "/summary",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    summary,
  );

  router
    .route("/")
    .get(
      requireAuth,
      authorize(PERMISSIONS.PAYMENTS_READ),
      validate({ query: paymentListQuerySchema }),
      list,
    )
    .post(
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
    validate({
      params: paymentIdSchema,
      body: captureSchema,
    }),
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

  return router;
}

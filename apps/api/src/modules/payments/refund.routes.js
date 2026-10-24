import express from "express";
import { z } from "zod";
import { PERMISSIONS } from "@pratyaya/shared";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { createRefundService } from "./refund.service.js";

const amountMinorSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)$/,
    "amountMinor must be a positive integer digit string",
  )
  .refine(
    (v) => BigInt(v) > 0n && BigInt(v) <= 1_000_000_000_000n,
    "Amount out of range",
  );

const currencySchema = z.enum(["USD", "INR"]);

const refundCreateSchema = z
  .object({
    amountMinor: amountMinorSchema,
    currency: currencySchema,
    reason: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

const refundQuerySchema = z
  .object({
    status: z
      .enum([
        "REQUESTED",
        "QUEUED",
        "PROCESSING",
        "SUCCEEDED",
        "FAILED",
        "UNKNOWN",
        "CANCELLED",
      ])
      .optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const refundConfirmSchema = z
  .object({
    providerEventId: z.string().trim().min(1).max(64),
    amountMinor: amountMinorSchema,
  })
  .strict();

const refundFailSchema = z
  .object({
    reason: z.string().trim().min(1).max(240),
    metadata: z.record(z.string().max(200)).optional(),
  })
  .strict();

export function createRefundRouter({ config }) {
  const router = express.Router();
  const requireAuth = authenticate({ config });
  let refundService;

  router.use(requireAuth);
  router.use(async (req, _res, next) => {
    if (!refundService) {
      refundService = await createRefundService(
        req.app.locals.config,
        req.app.locals.logger,
      );
    }
    next();
  });

  router.post(
    "/:paymentId/refunds",
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ body: refundCreateSchema }),
    async (req, res, next) => {
      try {
        const key = req.headers["idempotency-key"];
        if (!key) {
          return res.status(400).json({
            error: {
              code: "IDEMPOTENCY_KEY_REQUIRED",
              message: "Idempotency-Key header is required",
            },
            meta: { requestId: req.requestId },
          });
        }
        const result = await refundService.requestRefund({
          auth: req.auth,
          paymentId: req.params.paymentId,
          body: req.body,
          req: { headers: { "idempotency-key": key } },
        });
        res.status(result.idempotent ? 200 : 201).json({
          data: result.refund,
          meta: { requestId: req.requestId, idempotent: result.idempotent },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:paymentId/refunds",
    authorize(PERMISSIONS.PAYMENTS_READ),
    validate({ query: refundQuerySchema }),
    async (req, res, next) => {
      try {
        const result = await refundService.listRefunds({
          auth: req.auth,
          paymentId: req.params.paymentId,
          query: req.query,
        });
        res.json({
          data: result,
          meta: { requestId: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/refunds/:refundId",
    authorize(PERMISSIONS.PAYMENTS_READ),
    async (req, res, next) => {
      try {
        const refund = await refundService.getRefund({
          auth: req.auth,
          refundId: req.params.refundId,
        });
        res.json({
          data: refund,
          meta: { requestId: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/refunds/:refundId/process",
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    async (req, res, next) => {
      try {
        const result = await refundService.processRefund({
          refundId: req.params.refundId,
          auth: req.auth,
        });
        res.json({
          data: result.refund,
          meta: { requestId: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/refunds/:refundId/confirm",
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ body: refundConfirmSchema }),
    async (req, res, next) => {
      try {
        const result = await refundService.confirmRefund({
          refundId: req.params.refundId,
          auth: req.auth,
          providerEventId: req.body.providerEventId,
          amountMinor: req.body.amountMinor,
        });
        res.json({
          data: {
            refund: result.refund,
            payment: result.payment,
            journal: result.journal,
          },
          meta: { requestId: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/refunds/:refundId/fail",
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ body: refundFailSchema }),
    async (req, res, next) => {
      try {
        const result = await refundService.failRefund({
          refundId: req.params.refundId,
          auth: req.auth,
          reason: req.body.reason,
          metadata: req.body.metadata,
        });
        res.json({
          data: result.refund,
          meta: { requestId: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

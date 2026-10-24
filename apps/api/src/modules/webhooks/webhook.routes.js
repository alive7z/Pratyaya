import express from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import {
  processProviderWebhook,
  getInboxEvents,
  retryInboxEvent,
} from "./webhook.service.js";

export function createWebhookRouter({ _config }) {
  const router = express.Router();

  const inboxQuerySchema = z
    .object({
      status: z
        .enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"])
        .optional(),
      eventType: z.string().trim().max(64).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict();

  router.post("/provider", async (req, res, next) => {
    try {
      const result = await processProviderWebhook({
        payload: req.body,
        headers: req.headers,
        config: req.app.locals.config,
        logger: req.app.locals.logger,
      });
      res.status(result.duplicate ? 200 : 201).json({
        data: {
          inboxEventId: result.inboxEvent._id,
          duplicate: result.duplicate,
        },
        meta: { requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/inbox", validate(inboxQuerySchema), async (req, res, next) => {
    try {
      const result = await getInboxEvents({
        merchantId: req.auth.merchantId,
        query: req.validated.query,
      });
      res.json({
        data: {
          events: result.events.map((e) => ({
            id: String(e._id),
            source: e.source,
            providerEventId: e.providerEventId,
            eventType: e.eventType,
            paymentId: e.paymentId ? String(e.paymentId) : null,
            refundId: e.refundId ? String(e.refundId) : null,
            payload: e.payload,
            signatureVerified: e.signatureVerified,
            signatureError: e.signatureError,
            receivedAt: e.receivedAt,
            processedAt: e.processedAt,
            processingStatus: e.processingStatus,
            attemptCount: e.attemptCount,
            lastError: e.lastError,
          })),
          count: result.count,
        },
        meta: { requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/inbox/:eventId/retry", async (req, res, next) => {
    try {
      await retryInboxEvent({
        inboxEventId: req.params.eventId,
        merchantId: req.auth.merchantId,
      });
      res.json({ data: { retried: true }, meta: { requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

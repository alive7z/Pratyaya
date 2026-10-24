import { Router } from "express";
import { PERMISSIONS } from "@pratyaya/shared";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { sendData } from "../../lib/response.js";
import {
  getSandboxJobs,
  getSandboxWebhooks,
  getSandboxOutboxEvents,
  getProviderOperations,
  setProviderFaults,
  getProviderFaults,
  clearProviderFaults,
} from "./sandbox.service.js";

export function createSandboxRouter({ config }) {
  const router = Router();
  const auth = authenticate({ config });

  const sandboxPermission = [auth, authorize(PERMISSIONS.SYSTEM_HEALTH_READ)];

  const faultRuleSchema = z
    .object({
      type: z.enum([
        "timeout",
        "decline",
        "latency",
        "error",
        "duplicate_webhook",
      ]),
      enabled: z.boolean().default(false),
      delayMs: z.coerce.number().int().min(0).max(60000).optional(),
      statusCode: z.coerce.number().int().min(400).max(599).optional(),
      code: z.string().trim().max(64).optional(),
      message: z.string().trim().max(240).optional(),
    })
    .strict();

  const faultsSchema = z
    .object({
      enabled: z.boolean().default(false),
      rules: z.array(faultRuleSchema).max(10).default([]),
    })
    .strict();

  const querySchema = z
    .object({
      status: z.string().optional(),
      type: z.string().optional(),
      eventType: z.string().optional(),
      state: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    })
    .strict();

  router.get(
    "/jobs",
    ...sandboxPermission,
    validate({ query: querySchema }),
    async (req, res, next) => {
      try {
        sendData(
          req,
          res,
          await getSandboxJobs({ auth: req.auth, query: req.validated.query }),
          200,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/webhooks",
    ...sandboxPermission,
    validate({ query: querySchema }),
    async (req, res, next) => {
      try {
        sendData(
          req,
          res,
          await getSandboxWebhooks({
            auth: req.auth,
            query: req.validated.query,
          }),
          200,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/outbox",
    ...sandboxPermission,
    validate({ query: querySchema }),
    async (req, res, next) => {
      try {
        sendData(
          req,
          res,
          await getSandboxOutboxEvents({
            auth: req.auth,
            query: req.validated.query,
          }),
          200,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/provider-operations",
    ...sandboxPermission,
    validate({ query: querySchema }),
    async (req, res, next) => {
      try {
        sendData(
          req,
          res,
          await getProviderOperations({
            auth: req.auth,
            query: req.validated.query,
          }),
          200,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/faults",
    ...sandboxPermission,
    validate({ body: faultsSchema }),
    async (req, res, next) => {
      try {
        sendData(
          req,
          res,
          await setProviderFaults({
            auth: req.auth,
            body: req.validated.body,
            config,
          }),
          200,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/faults", ...sandboxPermission, async (req, res, next) => {
    try {
      sendData(req, res, await getProviderFaults({ config }), 200);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/faults", ...sandboxPermission, async (req, res, next) => {
    try {
      sendData(req, res, await clearProviderFaults({ config }), 200);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

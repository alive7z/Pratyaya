import { Router } from "express";
import { PERMISSIONS } from "@pratyaya/shared";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { sendData } from "../../lib/response.js";
import {
  RECONCILIATION_RECORD_STATUS,
  RECONCILIATION_CASE_STATUS,
} from "./reconciliation-record.model.js";
import {
  listReconciliationRecords,
  getReconciliationRecord,
  listReconciliationCases,
  getReconciliationCase,
  checkPaymentReconciliation,
} from "./reconciliation.service.js";

export function createReconciliationRouter({ config }) {
  const router = Router();
  const auth = authenticate({ config });

  router.get(
    "/",
    auth,
    authorize(PERMISSIONS.RECONCILIATION_READ),
    validate({
      query: z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          status: z.enum(RECONCILIATION_RECORD_STATUS).optional(),
        })
        .strict(),
    }),
    async (req, res, next) => {
      try {
        sendData(
          req,
          res,
          await listReconciliationRecords({
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
    "/summary",
    auth,
    authorize(PERMISSIONS.RECONCILIATION_READ),
    async (req, res, next) => {
      try {
        const result = await listReconciliationRecords({
          auth: req.auth,
          query: { limit: 1 },
        });
        sendData(req, res, { summary: result.summary }, 200);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:paymentId/check",
    auth,
    authorize(PERMISSIONS.RECONCILIATION_READ),
    validate({
      params: z
        .object({ paymentId: z.string().regex(/^[0-9a-fA-F]{24}$/) })
        .strict(),
    }),
    async (req, res, next) => {
      try {
        const result = await checkPaymentReconciliation({
          auth: req.auth,
          paymentId: req.validated.params.paymentId,
          config: req.app.locals.config,
          logger: req.app.locals.logger,
        });
        sendData(req, res, result, 200);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:recordId",
    auth,
    authorize(PERMISSIONS.RECONCILIATION_READ),
    validate({
      params: z
        .object({ recordId: z.string().regex(/^[0-9a-fA-F]{24}$/) })
        .strict(),
    }),
    async (req, res, next) => {
      try {
        sendData(
          req,
          res,
          await getReconciliationRecord({
            auth: req.auth,
            recordId: req.validated.params.recordId,
          }),
          200,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/cases",
    auth,
    authorize(PERMISSIONS.RECONCILIATION_READ),
    validate({
      query: z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          status: z.enum(RECONCILIATION_CASE_STATUS).optional(),
        })
        .strict(),
    }),
    async (req, res, next) => {
      try {
        sendData(
          req,
          res,
          await listReconciliationCases({
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
    "/cases/:caseId",
    auth,
    authorize(PERMISSIONS.RECONCILIATION_READ),
    validate({
      params: z
        .object({ caseId: z.string().regex(/^[0-9a-fA-F]{24}$/) })
        .strict(),
    }),
    async (req, res, next) => {
      try {
        sendData(
          req,
          res,
          await getReconciliationCase({
            auth: req.auth,
            caseId: req.validated.params.caseId,
          }),
          200,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

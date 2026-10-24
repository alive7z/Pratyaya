import { Router } from "express";
import { PERMISSIONS } from "@pratyaya/shared";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { sendData } from "../../lib/response.js";
import { RECONCILIATION_RECORD_STATUS } from "./reconciliation-record.model.js";
import {
  getReconciliationRecord,
  listReconciliationRecords,
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
  return router;
}

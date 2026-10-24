import { Router } from "express";
import {
  LEDGER_EVENT_TYPES,
  PERMISSIONS,
  SUPPORTED_CURRENCIES,
} from "@pratyaya/shared";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import {
  account,
  accountEntries,
  accounts,
  balances,
  integrityReport,
  integrityReports,
  journal,
  journals,
  runIntegrity,
  trialBalance,
} from "./ledger.controller.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier");
const pagination = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
const currency = z.enum(SUPPORTED_CURRENCIES).optional();

export function createLedgerRouter({ config }) {
  const router = Router();
  const auth = authenticate({ config });
  const read = [auth, authorize(PERMISSIONS.LEDGER_READ)];

  router.get(
    "/accounts",
    ...read,
    validate({
      query: z
        .object({
          ...pagination,
          currency,
          status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        })
        .strict(),
    }),
    accounts,
  );
  router.get(
    "/accounts/:accountId",
    ...read,
    validate({ params: z.object({ accountId: objectId }).strict() }),
    account,
  );
  router.get(
    "/accounts/:accountId/entries",
    ...read,
    validate({
      params: z.object({ accountId: objectId }).strict(),
      query: z.object(pagination).strict(),
    }),
    accountEntries,
  );
  router.get(
    "/journals",
    ...read,
    validate({
      query: z
        .object({
          ...pagination,
          currency,
          eventType: z.enum(Object.values(LEDGER_EVENT_TYPES)).optional(),
          accountId: objectId.optional(),
          search: z.string().trim().min(1).max(100).optional(),
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
        })
        .strict(),
    }),
    journals,
  );
  router.get(
    "/journals/:journalId",
    ...read,
    validate({ params: z.object({ journalId: objectId }).strict() }),
    journal,
  );
  router.get(
    "/balances",
    ...read,
    validate({ query: z.object({ currency }).strict() }),
    balances,
  );
  router.get(
    "/trial-balance",
    ...read,
    validate({ query: z.object({ currency }).strict() }),
    trialBalance,
  );
  router.post(
    "/integrity/check",
    auth,
    authorize(PERMISSIONS.LEDGER_INTEGRITY_RUN),
    requireCsrf,
    validate({ body: z.object({ currency }).strict() }),
    runIntegrity,
  );
  router.get(
    "/integrity/reports",
    ...read,
    validate({ query: z.object({ ...pagination, currency }).strict() }),
    integrityReports,
  );
  router.get(
    "/integrity/reports/:reportId",
    ...read,
    validate({ params: z.object({ reportId: objectId }).strict() }),
    integrityReport,
  );
  return router;
}

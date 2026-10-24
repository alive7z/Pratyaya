import { Router } from "express";
import { PERMISSIONS } from "@pratyaya/shared";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { requireCsrf } from "../../middleware/csrf.js";
import {
  createPolicy,
  getPolicy,
  updatePolicy,
  submitInvoice,
  getProposal,
  listProposals,
  decideProposal,
  executeProposal,
} from "./agentpay.controller.js";

const MINOR_UNITS_PATTERN = /^(0|[1-9]\d*)$/;
const proposalIdSchema = z.object({
  proposalId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid proposal ID"),
});

const policySchema = z
  .object({
    isEnabled: z.boolean().default(false),
    requireHumanApproval: z.boolean().default(true),
    autoApproveBelowMinor: z
      .string()
      .regex(MINOR_UNITS_PATTERN, "autoApproveBelowMinor must be an integer digit string")
      .optional(),
    allowedCurrencies: z.array(z.enum(["USD", "INR"])).default(["USD", "INR"]),
    maxInvoiceAgeDays: z.coerce.number().int().min(1).max(365).default(90),
    allowedPaymentPurposes: z.array(z.string().trim().max(200)).default([]),
    spendingLimits: z
      .array(
        z.object({
          currency: z.enum(["USD", "INR"]),
          maxAmountMinor: z.string().regex(MINOR_UNITS_PATTERN),
          period: z.enum(["PER_INVOICE", "DAILY", "WEEKLY", "MONTHLY"]),
        }),
      )
      .default([]),
    approvedSuppliers: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(200),
          normalizedName: z.string().trim().min(1).max(200).optional(),
          taxId: z.string().trim().max(100).optional(),
          accountNumber: z.string().trim().max(100).optional(),
        }),
      )
      .default([]),
    blockedSuppliers: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(200),
          normalizedName: z.string().trim().min(1).max(200).optional(),
          reason: z.string().trim().max(240).optional(),
        }),
      )
      .default([]),
  })
  .strict();

const submitInvoiceSchema = z
  .object({
    invoiceText: z.string().trim().min(1).max(10000),
    idempotencyKey: z.string().trim().min(8).max(255),
  })
  .strict();

const decideProposalSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export function createAgentPayRouter({ config }) {
  const router = Router();
  const requireAuth = authenticate({ config });

  router.get(
    "/policy",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    getPolicy,
  );

  router.post(
    "/policy",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ body: policySchema }),
    createPolicy,
  );

  router.put(
    "/policy",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ body: policySchema }),
    updatePolicy,
  );

  router.post(
    "/invoices",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ body: submitInvoiceSchema }),
    submitInvoice,
  );

  router.get(
    "/invoices/:proposalId",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    validate({ params: proposalIdSchema }),
    getProposal,
  );

  router.get(
    "/invoices",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    validate({
      query: z
        .object({
          status: z.string().optional(),
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          cursor: z.string().trim().min(1).max(512).optional(),
        })
        .strict(),
    }),
    listProposals,
  );

  router.post(
    "/invoices/:proposalId/decide",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ params: proposalIdSchema, body: decideProposalSchema }),
    decideProposal,
  );

  router.post(
    "/invoices/:proposalId/execute",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({ params: proposalIdSchema }),
    executeProposal,
  );

  return router;
}
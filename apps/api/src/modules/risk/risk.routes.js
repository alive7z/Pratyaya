import { Router } from "express";
import { PERMISSIONS } from "@pratyaya/shared";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import {
  evaluateRisk,
  getRiskDecision,
  listRiskDecisions,
  getRiskSummary,
  overrideRiskDecision,
  getRules,
  listRiskAlerts,
} from "./risk-decision.controller.js";

export function createRiskRouter({ config }) {
  const router = Router();
  const requireAuth = authenticate({ config });

  router.get(
    "/summary",
    requireAuth,
    authorize(PERMISSIONS.RISK_DASHBOARD_READ),
    getRiskSummary,
  );

  router.get(
    "/decisions",
    requireAuth,
    authorize(PERMISSIONS.RISK_DASHBOARD_READ),
    validate({
      query: z
        .object({
          decision: z.string().optional(),
          level: z.string().optional(),
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          cursor: z.string().trim().min(1).max(512).optional(),
        })
        .strict(),
    }),
    listRiskDecisions,
  );

  router.post(
    "/evaluate",
    requireAuth,
    authorize(PERMISSIONS.PAYMENTS_CREATE),
    requireCsrf,
    validate({
      body: z
        .object({
          merchantId: z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/)
            .optional(),
          paymentId: z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/)
            .optional(),
          amountMinor: z
            .string()
            .regex(
              /^(0|[1-9]\d*)$/,
              "amountMinor must be a positive integer digit string",
            )
            .refine(
              (v) => BigInt(v) > 0n && BigInt(v) <= 1_000_000_000_000n,
              "Amount out of range",
            ),
          currency: z.enum(["USD", "INR"]),
          customerReference: z.string().trim().max(120).optional(),
          description: z.string().trim().max(500).optional(),
          isDemo: z.boolean().optional(),
        })
        .strict(),
    }),
    evaluateRisk,
  );

  router.get(
    "/decisions/:decisionId",
    requireAuth,
    authorize(PERMISSIONS.RISK_ALERTS_READ),
    validate({
      params: z
        .object({ decisionId: z.string().regex(/^[0-9a-fA-F]{24}$/) })
        .strict(),
    }),
    getRiskDecision,
  );

  router.post(
    "/decisions/:decisionId/override",
    requireAuth,
    authorize(PERMISSIONS.RISK_ALERTS_READ),
    requireCsrf,
    validate({
      params: z
        .object({ decisionId: z.string().regex(/^[0-9a-fA-F]{24}$/) })
        .strict(),
      body: z
        .object({
          decision: z.enum(["ALLOW", "REVIEW", "BLOCK"]),
        })
        .strict(),
    }),
    overrideRiskDecision,
  );

  router.get(
    "/rules",
    requireAuth,
    authorize(PERMISSIONS.RISK_DASHBOARD_READ),
    getRules,
  );

  router.get(
    "/alerts",
    requireAuth,
    authorize(PERMISSIONS.RISK_ALERTS_READ),
    validate({
      query: z
        .object({
          severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
          status: z
            .enum(["OPEN", "IN_REVIEW", "ESCALATED", "CLEARED"])
            .optional(),
          ruleCode: z.string().trim().max(80).optional(),
          paymentId: z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/)
            .optional(),
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .strict(),
    }),
    listRiskAlerts,
  );

  return router;
}

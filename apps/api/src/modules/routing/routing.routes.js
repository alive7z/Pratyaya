import { Router } from "express";
import { PERMISSIONS } from "@pratyaya/shared";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import {
  getProviders,
  getProvider,
  getProviderHealth,
  getProviderMetrics,
  getRoutingDecisions,
  getRoutingDecision,
  getPaymentRouting,
  getRoutingPolicies,
  getRoutingPolicy,
  updateRoutingPolicy,
  getCircuitBreakers,
  getCircuitBreaker,
  resetCircuitBreaker,
  simulateRouting,
} from "./routing.controller.js";

export function createRoutingRouter({ config }) {
  const router = Router();
  const auth = authenticate({ config });

  router.get(
    "/providers",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    getProviders,
  );

  router.get(
    "/providers/:providerId",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    validate({ params: z.object({ providerId: z.string() }) }),
    getProvider,
  );

  router.get(
    "/providers/:providerId/health",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    validate({ params: z.object({ providerId: z.string() }) }),
    getProviderHealth,
  );

  router.get(
    "/providers/:providerId/metrics",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    validate({ params: z.object({ providerId: z.string() }) }),
    getProviderMetrics,
  );

  router.get(
    "/decisions",
    auth,
    authorize(PERMISSIONS.RECONCILIATION_READ),
    validate({
      query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        providerId: z.string().optional(),
        strategy: z.string().optional(),
      }),
    }),
    getRoutingDecisions,
  );

  router.get(
    "/decisions/:decisionId",
    auth,
    authorize(PERMISSIONS.RECONCILIATION_READ),
    validate({ params: z.object({ decisionId: z.string() }) }),
    getRoutingDecision,
  );

  router.get(
    "/payments/:paymentId",
    auth,
    authorize(PERMISSIONS.PAYMENTS_READ),
    validate({
      params: z.object({ paymentId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
    }),
    getPaymentRouting,
  );

  router.get(
    "/policies",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    getRoutingPolicies,
  );

  router.get(
    "/policies/:policyId",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    validate({ params: z.object({ policyId: z.string() }) }),
    getRoutingPolicy,
  );

  router.put(
    "/policies/:policyId",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    requireCsrf,
    validate({
      params: z.object({ policyId: z.string() }),
      body: z
        .object({
          strategy: z.string().optional(),
          allowedProviderIds: z.array(z.string()).optional(),
          preferredProviderId: z.string().optional(),
          weights: z
            .object({
              reliability: z.number().min(0).max(100),
              latency: z.number().min(0).max(100),
              cost: z.number().min(0).max(100),
            })
            .optional(),
          minimumHealthThreshold: z.number().min(0).max(1).optional(),
          fallbackEnabled: z.boolean().optional(),
          circuitBreakerEnabled: z.boolean().optional(),
          stickinessEnabled: z.boolean().optional(),
        })
        .strict(),
    }),
    updateRoutingPolicy,
  );

  router.get(
    "/circuit-breakers",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    getCircuitBreakers,
  );

  router.get(
    "/circuit-breakers/:providerId",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    validate({ params: z.object({ providerId: z.string() }) }),
    getCircuitBreaker,
  );

  router.post(
    "/circuit-breakers/:providerId/reset",
    auth,
    authorize(PERMISSIONS.SYSTEM_HEALTH_READ),
    requireCsrf,
    validate({ params: z.object({ providerId: z.string() }) }),
    resetCircuitBreaker,
  );

  router.post(
    "/simulate",
    auth,
    authorize(PERMISSIONS.DEVELOPER_DASHBOARD_READ),
    requireCsrf,
    validate({
      body: z
        .object({
          amountMinor: z.string().regex(/^(0|[1-9]\d*)$/),
          currency: z.enum(["USD", "INR"]),
          operationType: z.enum(["AUTHORIZE", "CAPTURE", "REFUND"]),
        })
        .strict(),
    }),
    simulateRouting,
  );

  return router;
}

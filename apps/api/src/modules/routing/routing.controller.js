import { sendData } from "../../lib/response.js";
import { RoutingService } from "./routing.service.js";
import { ProviderHealthService } from "./provider-health.service.js";
import { PaymentProvider } from "./payment-provider.model.js";
import { CircuitBreakerState } from "./circuit-breaker-state.model.js";
import { RoutingDecision } from "./routing-decision.model.js";
import { ProviderRoutingPolicy } from "./provider-routing-policy.model.js";
import { ProviderHealthSnapshot } from "./provider-health-snapshot.model.js";
import { AppError } from "../../lib/errors.js";

let routingService;
let healthService;

function getRoutingService(req) {
  if (!routingService) {
    routingService = new RoutingService(
      req.app.locals.config,
      req.app.locals.logger,
    );
  }
  return routingService;
}

function getHealthService(req) {
  if (!healthService) {
    healthService = new ProviderHealthService(
      req.app.locals.config,
      req.app.locals.logger,
    );
  }
  return healthService;
}

export async function getProviders(req, res, next) {
  try {
    const providers = await PaymentProvider.find({ enabled: true }).lean();
    sendData(
      req,
      res,
      providers.map((p) => ({
        providerId: p.providerId,
        providerName: p.providerName,
        status: p.status,
        enabled: p.enabled,
        supportedCurrencies: p.supportedCurrencies,
        supportedOperations: p.supportedOperations,
        routingWeight: p.routingWeight,
        healthMetrics: p.healthMetrics,
        circuitBreaker: p.circuitBreaker,
      })),
      200,
    );
  } catch (error) {
    next(error);
  }
}

export async function getProvider(req, res, next) {
  try {
    const provider = await PaymentProvider.findOne({
      providerId: req.params.providerId,
      enabled: true,
    }).lean();
    if (!provider) {
      throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found");
    }
    sendData(
      req,
      res,
      {
        providerId: provider.providerId,
        providerName: provider.providerName,
        status: provider.status,
        enabled: provider.enabled,
        supportedCurrencies: provider.supportedCurrencies,
        supportedOperations: provider.supportedOperations,
        transactionCost: provider.transactionCost,
        routingWeight: provider.routingWeight,
        config: {
          baseUrl: provider.config.baseUrl,
          timeoutMs: provider.config.timeoutMs,
          retryAttempts: provider.config.retryAttempts,
        },
        healthMetrics: provider.healthMetrics,
        circuitBreaker: provider.circuitBreaker,
      },
      200,
    );
  } catch (error) {
    next(error);
  }
}

export async function getProviderHealth(req, res, next) {
  try {
    const service = getHealthService(req);
    await service.initializeProviders();
    const summary = await service.getHealthSummary(req.params.providerId);
    sendData(req, res, summary, 200);
  } catch (error) {
    next(error);
  }
}

export async function getProviderMetrics(req, res, next) {
  try {
    const snapshots = await ProviderHealthSnapshot.find({
      providerId: req.params.providerId,
    })
      .sort({ calculatedAt: -1 })
      .limit(100)
      .lean();
    sendData(req, res, snapshots, 200);
  } catch (error) {
    next(error);
  }
}

export async function getRoutingDecisions(req, res, next) {
  try {
    const { page = 1, limit = 20, providerId, strategy } = req.query;
    const filter = { merchantId: req.auth.merchantId };
    if (providerId) filter.selectedProviderId = providerId;
    if (strategy) filter.routingStrategy = strategy;

    const decisions = await RoutingDecision.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await RoutingDecision.countDocuments(filter);

    sendData(
      req,
      res,
      { items: decisions, page: Number(page), limit: Number(limit), total },
      200,
    );
  } catch (error) {
    next(error);
  }
}

export async function getRoutingDecision(req, res, next) {
  try {
    const decision = await RoutingDecision.findOne({
      decisionId: req.params.decisionId,
      merchantId: req.auth.merchantId,
    }).lean();

    if (!decision) {
      throw new AppError(
        404,
        "ROUTING_DECISION_NOT_FOUND",
        "Routing decision not found",
      );
    }

    sendData(req, res, decision, 200);
  } catch (error) {
    next(error);
  }
}

export async function getPaymentRouting(req, res, next) {
  try {
    const decision = await RoutingDecision.findOne({
      paymentId: req.params.paymentId,
      merchantId: req.auth.merchantId,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!decision) {
      throw new AppError(
        404,
        "ROUTING_DECISION_NOT_FOUND",
        "No routing decision found for this payment",
      );
    }

    sendData(req, res, decision, 200);
  } catch (error) {
    next(error);
  }
}

export async function getRoutingPolicies(req, res, next) {
  try {
    const policies = await ProviderRoutingPolicy.find({
      isActive: true,
    }).lean();
    sendData(req, res, policies, 200);
  } catch (error) {
    next(error);
  }
}

export async function getRoutingPolicy(req, res, next) {
  try {
    const policy = await ProviderRoutingPolicy.findById(
      req.params.policyId,
    ).lean();
    if (!policy) {
      throw new AppError(404, "POLICY_NOT_FOUND", "Routing policy not found");
    }
    sendData(req, res, policy, 200);
  } catch (error) {
    next(error);
  }
}

export async function updateRoutingPolicy(req, res, next) {
  try {
    const {
      strategy,
      allowedProviderIds,
      preferredProviderId,
      weights,
      minimumHealthThreshold,
      fallbackEnabled,
      circuitBreakerEnabled,
      stickinessEnabled,
    } = req.body;

    if (weights) {
      const total =
        (weights.reliability ?? 0) +
        (weights.latency ?? 0) +
        (weights.cost ?? 0);
      if (total !== 100) {
        throw new AppError(
          400,
          "INVALID_WEIGHTS",
          "Routing weights must sum to 100",
        );
      }
    }

    const policy = await ProviderRoutingPolicy.findByIdAndUpdate(
      req.params.policyId,
      {
        $set: {
          strategy,
          allowedProviderIds,
          preferredProviderId,
          weights,
          minimumHealthThreshold,
          fallbackEnabled,
          circuitBreakerEnabled,
          stickinessEnabled,
          updatedBy: req.auth.user?._id ?? req.auth.userId,
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (!policy) {
      throw new AppError(404, "POLICY_NOT_FOUND", "Routing policy not found");
    }

    sendData(req, res, policy, 200);
  } catch (error) {
    next(error);
  }
}

export async function getCircuitBreakers(req, res, next) {
  try {
    const breakers = await CircuitBreakerState.find({}).lean();
    sendData(req, res, breakers, 200);
  } catch (error) {
    next(error);
  }
}

export async function getCircuitBreaker(req, res, next) {
  try {
    const breaker = await CircuitBreakerState.findOne({
      providerId: req.params.providerId,
    }).lean();
    if (!breaker) {
      throw new AppError(
        404,
        "CIRCUIT_BREAKER_NOT_FOUND",
        "Circuit breaker not found",
      );
    }
    sendData(req, res, breaker, 200);
  } catch (error) {
    next(error);
  }
}

export async function resetCircuitBreaker(req, res, next) {
  try {
    const breaker = await CircuitBreakerState.findOneAndUpdate(
      { providerId: req.params.providerId },
      {
        $set: {
          state: "CLOSED",
          failureCount: 0,
          successCount: 0,
          openedAt: null,
          nextProbeAt: null,
          halfOpenLeaseOwner: null,
          halfOpenLeaseExpiresAt: null,
          lastStateChangeAt: new Date(),
        },
        $inc: { version: 1 },
      },
      { returnDocument: "after" },
    ).lean();

    if (!breaker) {
      throw new AppError(
        404,
        "CIRCUIT_BREAKER_NOT_FOUND",
        "Circuit breaker not found",
      );
    }

    sendData(req, res, { breaker, reset: true }, 200);
  } catch (error) {
    next(error);
  }
}

export async function simulateRouting(req, res, next) {
  try {
    const service = getRoutingService(req);
    await service.initializeProviders();

    const { amountMinor, currency, operationType } = req.body;
    if (!amountMinor || !currency || !operationType) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "amountMinor, currency, and operationType are required",
      );
    }

    const policy = await service.getRoutingPolicy({
      merchantId: req.auth.merchantId,
    });
    const payment = {
      amountMinor: BigInt(amountMinor),
      currency,
      operationType,
    };

    const { eligible, rejected } = await service.getEligibleProviders(
      payment,
      policy,
    );

    if (eligible.length === 0) {
      return sendData(
        req,
        res,
        {
          eligibleProviders: [],
          rejectedProviders: rejected.map((r) => ({
            providerId: r.providerId,
            reason: r.reason,
          })),
          selectedProvider: null,
          decisionReason: "NO_ELIGIBLE_PROVIDER",
          message: "No eligible providers for this payment",
        },
        200,
      );
    }

    const scored = service.calculateScores(eligible, policy, payment);
    const selected = service.selectProvider(scored, policy);

    sendData(
      req,
      res,
      {
        eligibleProviders: eligible.map((p) => p.providerId),
        rejectedProviders: rejected.map((r) => ({
          providerId: r.providerId,
          reason: r.reason,
        })),
        scores: scored,
        selectedProvider: selected.providerId,
        decisionReason: "PROVIDER_SELECTED",
        strategy: policy.strategy,
      },
      200,
    );
  } catch (error) {
    next(error);
  }
}

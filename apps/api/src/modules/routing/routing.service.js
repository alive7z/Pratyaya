import {
  PROVIDER_IDS,
  ROUTING_STRATEGIES,
  ROUTING_DECISION_REASON,
} from "@pratyaya/shared";
import { PaymentProvider } from "./payment-provider.model.js";
import { CircuitBreakerState } from "./circuit-breaker-state.model.js";
import { RoutingDecision } from "./routing-decision.model.js";
import { ProviderRoutingPolicy } from "./provider-routing-policy.model.js";
import { createMockProviderAdapter } from "./mock-provider-adapter.js";
import { AppError } from "../../lib/errors.js";

function generateDecisionId() {
  return `route_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeScore(value, min, max) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export class RoutingService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.providerAdapters = new Map();
  }

  async initializeProviders() {
    const providers = await PaymentProvider.find({
      enabled: true,
      status: "ACTIVE",
    }).lean();
    for (const provider of providers) {
      const adapter = createMockProviderAdapter(provider.providerId, {
        baseUrl: provider.config.baseUrl,
        hmacSecret: provider.config.hmacSecret,
        timeoutMs: provider.config.timeoutMs,
        retryAttempts: provider.config.retryAttempts,
        faults: provider.config.faults,
      });
      this.providerAdapters.set(provider.providerId, adapter);
    }
    return providers.length;
  }

  getProviderAdapter(providerId) {
    return this.providerAdapters.get(providerId);
  }

  async getProviderHealth(providerId) {
    const adapter = this.providerAdapters.get(providerId);
    if (!adapter) return { healthy: false, latencyMs: null };
    return adapter.getHealthStatus();
  }

  async getRoutingPolicy({ merchantId, scope = "merchant" }) {
    let policy;
    if (scope === "merchant" && merchantId) {
      policy = await ProviderRoutingPolicy.findOne({
        scope: "merchant",
        merchantId,
        isActive: true,
      }).lean();
    }
    if (!policy) {
      policy = await ProviderRoutingPolicy.findOne({
        scope: "global",
        isActive: true,
      }).lean();
    }
    return policy ?? this.getDefaultPolicy();
  }

  getDefaultPolicy() {
    return {
      strategy: "BALANCED_ADAPTIVE",
      allowedProviderIds: Object.values(PROVIDER_IDS),
      weights: { reliability: 50, latency: 30, cost: 20 },
      minimumHealthThreshold: 0.95,
      fallbackEnabled: true,
      circuitBreakerEnabled: true,
      stickinessEnabled: true,
    };
  }

  async getCircuitBreakerState(providerId, operationType) {
    let state = await CircuitBreakerState.findOne({
      providerId,
      operationType,
    }).lean();
    if (!state) {
      state = await CircuitBreakerState.create({
        providerId,
        operationType,
        state: "CLOSED",
        failureThreshold: 5,
        successThreshold: 2,
        timeoutMs: 60000,
        halfOpenMaxRequests: 3,
      });
    }
    return state;
  }

  async checkCircuitBreaker(providerId, operationType) {
    const state = await this.getCircuitBreakerState(providerId, operationType);

    if (state.state === "OPEN") {
      if (state.nextProbeAt && new Date() >= state.nextProbeAt) {
        await this.transitionToHalfOpen(providerId, operationType);
        return { allowed: true, state: "HALF_OPEN", reason: "HALF_OPEN_PROBE" };
      }
      return {
        allowed: false,
        state: "OPEN",
        reason: "CIRCUIT_BREAKER_OPEN",
        nextProbeAt: state.nextProbeAt,
      };
    }

    if (state.state === "HALF_OPEN") {
      if (
        state.halfOpenLeaseExpiresAt &&
        new Date() < state.halfOpenLeaseExpiresAt &&
        state.halfOpenLeaseOwner
      ) {
        return {
          allowed: false,
          state: "HALF_OPEN",
          reason: "HALF_OPEN_LEASED",
          leaseOwner: state.halfOpenLeaseOwner,
        };
      }
      return { allowed: true, state: "HALF_OPEN", reason: "HALF_OPEN_PROBE" };
    }

    return { allowed: true, state: "CLOSED" };
  }

  async transitionToHalfOpen(providerId, operationType) {
    const state = await CircuitBreakerState.findOneAndUpdate(
      {
        providerId,
        operationType,
        state: "OPEN",
        nextProbeAt: { $lte: new Date() },
      },
      {
        $set: {
          state: "HALF_OPEN",
          halfOpenLeaseOwner: `worker-${process.pid}`,
          halfOpenLeaseExpiresAt: new Date(Date.now() + 30000),
          successCount: 0,
        },
        $inc: { version: 1 },
      },
      { returnDocument: "after" },
    );
    return state;
  }

  async recordCircuitBreakerResult(providerId, operationType, success) {
    const state = await CircuitBreakerState.findOne({
      providerId,
      operationType,
    });
    if (!state) return;

    if (state.state === "HALF_OPEN") {
      if (success) {
        state.successCount += 1;
        if (state.successCount >= state.successThreshold) {
          state.state = "CLOSED";
          state.failureCount = 0;
          state.successCount = 0;
          state.lastStateChangeAt = new Date();
        }
      } else {
        state.state = "OPEN";
        state.failureCount += 1;
        state.openedAt = new Date();
        state.nextProbeAt = new Date(Date.now() + state.timeoutMs);
        state.lastStateChangeAt = new Date();
      }
    } else if (state.state === "CLOSED") {
      state.totalRequests += 1;
      if (success) {
        state.failureCount = 0;
      } else {
        state.failedRequests += 1;
        state.failureCount += 1;
        state.lastFailureAt = new Date();
        if (state.failureCount >= state.failureThreshold) {
          state.state = "OPEN";
          state.openedAt = new Date();
          state.nextProbeAt = new Date(Date.now() + state.timeoutMs);
          state.lastStateChangeAt = new Date();
        }
      }
    }

    state.updatedAt = new Date();
    state.version += 1;
    await state.save();
    return state;
  }

  async claimHalfOpenLease(providerId, operationType, workerId) {
    const state = await CircuitBreakerState.findOneAndUpdate(
      {
        providerId,
        operationType,
        state: "HALF_OPEN",
        $or: [
          { halfOpenLeaseOwner: { $exists: false } },
          { halfOpenLeaseOwner: workerId },
          { halfOpenLeaseExpiresAt: { $lt: new Date() } },
        ],
      },
      {
        $set: {
          halfOpenLeaseOwner: workerId,
          halfOpenLeaseExpiresAt: new Date(Date.now() + 30000),
        },
        $inc: { version: 1 },
      },
      { returnDocument: "after" },
    );
    return !!state;
  }

  async releaseHalfOpenLease(providerId, operationType, workerId) {
    await CircuitBreakerState.findOneAndUpdate(
      { providerId, operationType, halfOpenLeaseOwner: workerId },
      { $unset: { halfOpenLeaseOwner: 1, halfOpenLeaseExpiresAt: 1 } },
    );
  }

  async getEligibleProviders(payment, policy) {
    const providers = await PaymentProvider.find({
      providerId: { $in: policy.allowedProviderIds },
      enabled: true,
      status: "ACTIVE",
      supportedCurrencies: payment.currency,
      supportedOperations: payment.operationType,
    }).lean();

    const eligible = [];
    const rejected = [];

    for (const provider of providers) {
      let isEligible = true;
      let reason = null;

      if (policy.circuitBreakerEnabled) {
        const cbCheck = await this.checkCircuitBreaker(
          provider.providerId,
          payment.operationType,
        );
        if (!cbCheck.allowed) {
          isEligible = false;
          reason = `Circuit breaker: ${cbCheck.reason}`;
        }
      }

      if (isEligible && policy.minimumHealthThreshold) {
        const health = provider.healthMetrics?.availability ?? 1;
        if (health < policy.minimumHealthThreshold) {
          isEligible = false;
          reason = `Health below threshold: ${health} < ${policy.minimumHealthThreshold}`;
        }
      }

      if (isEligible) {
        eligible.push(provider);
      } else {
        rejected.push({
          providerId: provider.providerId,
          reason: reason ?? "Unknown",
        });
      }
    }

    return { eligible, rejected };
  }

  calculateScores(providers, policy, payment) {
    const weights = {
      reliability: (policy.weights?.reliability ?? 50) / 100,
      latency: (policy.weights?.latency ?? 30) / 100,
      cost: (policy.weights?.cost ?? 20) / 100,
    };

    const totalWeight = weights.reliability + weights.latency + weights.cost;
    if (Math.abs(totalWeight - 1) > 0.001) {
      throw new AppError(
        400,
        "INVALID_WEIGHTS",
        "Routing weights must sum to 100",
      );
    }

    const latencies = providers.map(
      (p) => p.healthMetrics?.latencyP50Ms ?? p.config?.timeoutMs ?? 15000,
    );
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);

    const costs = providers.map((p) =>
      this.calculateTransactionCost(p, payment.amountMinor),
    );
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);

    const reliabilities = providers.map(
      (p) => p.healthMetrics?.availability ?? 1,
    );
    const minReliability = Math.min(...reliabilities);
    const maxReliability = Math.max(...reliabilities);

    return providers.map((provider, index) => {
      const reliabilityScore = normalizeScore(
        reliabilities[index],
        minReliability,
        maxReliability,
      );
      const latencyScore =
        1 - normalizeScore(latencies[index], minLatency, maxLatency);
      const costScore = 1 - normalizeScore(costs[index], minCost, maxCost);

      const weightedScore =
        reliabilityScore * weights.reliability +
        latencyScore * weights.latency +
        costScore * weights.cost;

      return {
        providerId: provider.providerId,
        reliabilityScore: Math.round(reliabilityScore * 10000) / 10000,
        latencyScore: Math.round(latencyScore * 10000) / 10000,
        costScore: Math.round(costScore * 10000) / 10000,
        weightedScore: Math.round(weightedScore * 10000) / 10000,
        eligibilityReason: "ELIGIBLE",
      };
    });
  }

  calculateTransactionCost(provider, amountMinor) {
    const cost = provider.transactionCost;
    if (!cost) return Number.MAX_SAFE_INTEGER;

    switch (cost.type) {
      case "fixed":
        return Number(cost.fixedMinor ?? 0);
      case "percentage":
        return Math.round(
          (Number(amountMinor) * (cost.percentageBps ?? 0)) / 10000,
        );
      case "tiered":
        for (const tier of cost.tiers ?? []) {
          const min = Number(tier.minAmountMinor ?? 0);
          const max = tier.maxAmountMinor
            ? Number(tier.maxAmountMinor)
            : Infinity;
          if (Number(amountMinor) >= min && Number(amountMinor) <= max) {
            return Math.round(
              (Number(amountMinor) * (tier.percentageBps ?? 0)) / 10000 +
                Number(tier.fixedMinor ?? 0),
            );
          }
        }
        return Number.MAX_SAFE_INTEGER;
      default:
        return Number.MAX_SAFE_INTEGER;
    }
  }

  selectProvider(scoredProviders, policy) {
    if (scoredProviders.length === 0) return null;

    switch (policy.strategy) {
      case ROUTING_STRATEGIES.RELIABILITY_FIRST:
        return scoredProviders.reduce((best, current) =>
          current.reliabilityScore > best.reliabilityScore ? current : best,
        );

      case ROUTING_STRATEGIES.LOWEST_LATENCY:
        return scoredProviders.reduce((best, current) =>
          current.latencyScore > best.latencyScore ? current : best,
        );

      case ROUTING_STRATEGIES.LOWEST_COST:
        return scoredProviders.reduce((best, current) =>
          current.costScore > best.costScore ? current : best,
        );

      case ROUTING_STRATEGIES.BALANCED_ADAPTIVE:
      default:
        return scoredProviders.reduce((best, current) =>
          current.weightedScore > best.weightedScore ? current : best,
        );
    }
  }

  async routePayment({ payment, policy, existingBinding = null }) {
    if (existingBinding && policy.stickinessEnabled) {
      return {
        providerId: existingBinding.providerId,
        decisionId: generateDecisionId(),
        decisionReason: ROUTING_DECISION_REASON.PROVIDER_SELECTED,
        scoreBreakdown: [],
        eligibleProviders: [existingBinding.providerId],
        rejectedProviders: [],
        isSticky: true,
      };
    }

    const { eligible, rejected } = await this.getEligibleProviders(
      payment,
      policy,
    );

    if (eligible.length === 0) {
      return {
        providerId: null,
        decisionId: generateDecisionId(),
        decisionReason: ROUTING_DECISION_REASON.NO_ELIGIBLE_PROVIDER,
        scoreBreakdown: [],
        eligibleProviders: [],
        rejectedProviders: rejected.map((r) => ({
          providerId: r.providerId,
          reason: r.reason,
        })),
        isSticky: false,
      };
    }

    const scored = this.calculateScores(eligible, policy, payment);
    const selected = this.selectProvider(scored, policy);

    return {
      providerId: selected.providerId,
      decisionId: generateDecisionId(),
      decisionReason: ROUTING_DECISION_REASON.PROVIDER_SELECTED,
      scoreBreakdown: scored,
      eligibleProviders: eligible.map((p) => p.providerId),
      rejectedProviders: rejected.map((r) => ({
        providerId: r.providerId,
        reason: r.reason,
      })),
      isSticky: false,
    };
  }

  async recordRoutingDecision(decision) {
    await RoutingDecision.create({
      decisionId: decision.decisionId,
      merchantId: decision.merchantId,
      paymentId: decision.paymentId,
      operationType: decision.operationType,
      amountMinor: decision.amountMinor,
      currency: decision.currency,
      selectedProviderId: decision.providerId,
      eligibleProviders: decision.eligibleProviders,
      rejectedProviders: decision.rejectedProviders,
      routingStrategy: decision.policy?.strategy ?? "BALANCED_ADAPTIVE",
      scoreBreakdown: decision.scoreBreakdown,
      policyVersion: decision.policyVersion,
      decisionReason: decision.decisionReason,
      metadata: decision.metadata,
    });
  }

  async executePaymentOperation({
    operationType,
    adapter,
    idempotencyKey,
    merchantId,
    requestData,
  }) {
    let result;
    switch (operationType) {
      case "AUTHORIZE":
        result = await adapter.authorizePayment({
          ...requestData,
          idempotencyKey,
          merchantId,
        });
        break;
      case "CAPTURE":
        result = await adapter.capturePayment({
          ...requestData,
          idempotencyKey,
          merchantId,
        });
        break;
      case "REFUND":
        result = await adapter.refundPayment({
          ...requestData,
          idempotencyKey,
          merchantId,
        });
        break;
      default:
        throw new AppError(
          400,
          "INVALID_OPERATION",
          `Unknown operation type: ${operationType}`,
        );
    }
    return result;
  }
}

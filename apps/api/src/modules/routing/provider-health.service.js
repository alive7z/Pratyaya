import { PaymentProvider } from "./payment-provider.model.js";
import { ProviderHealthSnapshot } from "./provider-health-snapshot.model.js";
import { ProviderOperation } from "../payments/operations/provider-operation.model.js";
import { ReconciliationCase } from "../reconciliation/reconciliation-record.model.js";
import { createMockProviderAdapter } from "./mock-provider-adapter.js";

const OBSERVATION_WINDOWS = ["1m", "5m", "15m", "1h", "6h", "24h"];

function calculatePercentiles(values, percentiles) {
  if (values.length === 0) return {};
  const sorted = [...values].sort((a, b) => a - b);
  const result = {};
  for (const p of percentiles) {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    result[`p${p}`] = sorted[Math.max(0, index)];
  }
  return result;
}

export class ProviderHealthService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.providerAdapters = new Map();
  }

  async initializeProviders() {
    const providers = await PaymentProvider.find({ enabled: true }).lean();
    for (const provider of providers) {
      const adapter = createMockProviderAdapter(provider.providerId, {
        baseUrl: provider.config.baseUrl,
        hmacSecret: provider.config.hmacSecret,
        timeoutMs: provider.config.timeoutMs,
        retryAttempts: provider.config.retryAttempts,
      });
      this.providerAdapters.set(provider.providerId, adapter);
    }
  }

  async collectHealthMetrics() {
    const providers = await PaymentProvider.find({ enabled: true }).lean();
    const results = [];

    for (const provider of providers) {
      const adapter = createMockProviderAdapter(provider.providerId, {
        baseUrl: provider.config.baseUrl,
        hmacSecret: provider.config.hmacSecret,
        timeoutMs: provider.config.timeoutMs,
        retryAttempts: provider.config.retryAttempts,
      });

      const health = await adapter.getHealthStatus();
      const windowMetrics = await this.calculateWindowMetrics(
        provider.providerId,
      );

      results.push({
        providerId: provider.providerId,
        health,
        windowMetrics,
      });

      await this.storeHealthSnapshots(
        provider.providerId,
        windowMetrics,
        health,
      );
    }

    return results;
  }

  async calculateWindowMetrics(providerId) {
    const now = new Date();
    const metrics = {};

    for (const window of OBSERVATION_WINDOWS) {
      const windowMs = this.parseWindow(window);
      const windowStart = new Date(now.getTime() - windowMs);

      const operations = await ProviderOperation.find({
        providerId,
        createdAt: { $gte: windowStart, $lte: now },
      }).lean();

      const totalRequests = operations.length;
      const successfulRequests = operations.filter(
        (o) => o.state === "SUCCEEDED",
      ).length;
      const failedRequests = operations.filter(
        (o) => o.state === "FAILED",
      ).length;
      const confirmedDeclines = operations.filter(
        (o) => o.state === "DECLINED",
      ).length;
      const infrastructureFailures = operations.filter((o) =>
        ["timeout", "error"].includes(o.faultInjected ?? ""),
      ).length;
      const timeouts = operations.filter(
        (o) => o.faultInjected === "timeout",
      ).length;

      const completedOps = operations.filter(
        (o) => o.processingStartedAt && o.processingCompletedAt,
      );
      const latencies = completedOps.map(
        (o) =>
          new Date(o.processingCompletedAt).getTime() -
          new Date(o.processingStartedAt).getTime(),
      );

      const percentiles = calculatePercentiles(latencies, [50, 95, 99]);

      const circuitBreaker = await this.getCircuitBreakerState(providerId);

      const unresolvedOps = operations.filter((o) =>
        ["UNKNOWN", "IN_FLIGHT", "PROCESSING"].includes(o.state),
      ).length;

      const reconciliationCases = await ReconciliationCase.countDocuments({
        providerId,
        status: { $in: ["OPEN", "IN_PROGRESS"] },
      });

      metrics[window] = {
        window,
        windowStart,
        windowEnd: now,
        totalRequests,
        successfulRequests,
        failedRequests,
        confirmedDeclines,
        infrastructureFailures,
        timeouts,
        rollingLatencyMs:
          latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : null,
        p50LatencyMs: percentiles.p50 ?? null,
        p95LatencyMs: percentiles.p95 ?? null,
        p99LatencyMs: percentiles.p99 ?? null,
        sampleCount: latencies.length,
        availability:
          totalRequests > 0
            ? (totalRequests - infrastructureFailures) / totalRequests
            : 1,
        errorRate:
          totalRequests > 0 ? infrastructureFailures / totalRequests : 0,
        successRate: totalRequests > 0 ? successfulRequests / totalRequests : 1,
        timeoutRate: totalRequests > 0 ? timeouts / totalRequests : 0,
        circuitBreakerState: circuitBreaker?.state ?? "CLOSED",
        activeUnresolvedOperations: unresolvedOps,
        reconciliationBacklog: reconciliationCases,
      };
    }

    return metrics;
  }

  parseWindow(window) {
    const unit = window.slice(-1);
    const value = parseInt(window.slice(0, -1));
    switch (unit) {
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        return 60000;
    }
  }

  async getCircuitBreakerState(_providerId) {
    // This would be imported from circuit-breaker-state.model.js
    // For now return mock
    return { state: "CLOSED" };
  }

  async storeHealthSnapshots(providerId, windowMetrics, _health) {
    const now = new Date();

    for (const [window, metrics] of Object.entries(windowMetrics)) {
      await ProviderHealthSnapshot.findOneAndUpdate(
        {
          providerId,
          observationWindow: window,
          windowStart: metrics.windowStart,
          windowEnd: metrics.windowEnd,
        },
        {
          $set: {
            ...metrics,
            calculatedAt: now,
          },
        },
        { upsert: true, new: true },
      );
    }

    await PaymentProvider.findByIdAndUpdate(
      { providerId },
      {
        $set: {
          "healthMetrics.availability": windowMetrics["5m"]?.availability ?? 1,
          "healthMetrics.errorRate": windowMetrics["5m"]?.errorRate ?? 0,
          "healthMetrics.successRate": windowMetrics["5m"]?.successRate ?? 1,
          "healthMetrics.timeoutRate": windowMetrics["5m"]?.timeoutRate ?? 0,
          "healthMetrics.latencyP50Ms":
            windowMetrics["5m"]?.p50LatencyMs ?? null,
          "healthMetrics.latencyP95Ms":
            windowMetrics["5m"]?.p95LatencyMs ?? null,
          "healthMetrics.latencyP99Ms":
            windowMetrics["5m"]?.p99LatencyMs ?? null,
          "healthMetrics.lastCalculatedAt": now,
        },
      },
    );
  }

  async getHealthSummary(providerId) {
    const snapshots = await ProviderHealthSnapshot.find({ providerId })
      .sort({ calculatedAt: -1 })
      .limit(10)
      .lean();

    const provider = await PaymentProvider.findOne({ providerId }).lean();

    return {
      providerId,
      providerName: provider?.providerName,
      status: provider?.status,
      circuitBreaker: provider?.circuitBreaker,
      healthMetrics: provider?.healthMetrics,
      recentSnapshots: snapshots,
    };
  }

  async getAllHealthSummaries() {
    const providers = await PaymentProvider.find({ enabled: true }).lean();
    return Promise.all(
      providers.map((p) => this.getHealthSummary(p.providerId)),
    );
  }
}

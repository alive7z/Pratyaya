import mongoose from "mongoose";
import { PROVIDER_IDS } from "@pratyaya/shared";

const providerHealthSnapshotSchema = new mongoose.Schema(
  {
    providerId: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_IDS),
      index: true,
    },
    observationWindow: {
      type: String,
      enum: ["1m", "5m", "15m", "1h", "6h", "24h"],
      required: true,
      index: true,
    },
    windowStart: { type: Date, required: true, index: true },
    windowEnd: { type: Date, required: true },
    totalRequests: { type: Number, min: 0, default: 0 },
    successfulRequests: { type: Number, min: 0, default: 0 },
    failedRequests: { type: Number, min: 0, default: 0 },
    confirmedDeclines: { type: Number, min: 0, default: 0 },
    infrastructureFailures: { type: Number, min: 0, default: 0 },
    timeouts: { type: Number, min: 0, default: 0 },
    rollingLatencyMs: { type: Number, min: 0 },
    p50LatencyMs: { type: Number, min: 0 },
    p95LatencyMs: { type: Number, min: 0 },
    p99LatencyMs: { type: Number, min: 0 },
    sampleCount: { type: Number, min: 0, default: 0 },
    availability: { type: Number, min: 0, max: 1 },
    errorRate: { type: Number, min: 0, max: 1 },
    successRate: { type: Number, min: 0, max: 1 },
    timeoutRate: { type: Number, min: 0, max: 1 },
    circuitBreakerState: {
      type: String,
      enum: ["CLOSED", "OPEN", "HALF_OPEN"],
      default: "CLOSED",
    },
    activeUnresolvedOperations: { type: Number, min: 0, default: 0 },
    reconciliationBacklog: { type: Number, min: 0, default: 0 },
    calculatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false },
);

providerHealthSnapshotSchema.index(
  { providerId: 1, observationWindow: 1, windowStart: -1 },
  { unique: true },
);
providerHealthSnapshotSchema.index({ providerId: 1, calculatedAt: -1 });

export const ProviderHealthSnapshot =
  mongoose.models.ProviderHealthSnapshot ??
  mongoose.model("ProviderHealthSnapshot", providerHealthSnapshotSchema);

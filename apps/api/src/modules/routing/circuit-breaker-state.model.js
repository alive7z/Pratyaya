import mongoose from "mongoose";
import {
  PROVIDER_IDS,
  OPERATION_TYPES,
  CIRCUIT_BREAKER_STATE,
} from "@pratyaya/shared";

const circuitBreakerStateSchema = new mongoose.Schema(
  {
    providerId: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_IDS),
      index: true,
    },
    operationType: {
      type: String,
      enum: Object.values(OPERATION_TYPES),
      required: true,
    },
    state: {
      type: String,
      enum: Object.values(CIRCUIT_BREAKER_STATE),
      required: true,
      default: CIRCUIT_BREAKER_STATE.CLOSED,
      index: true,
    },
    failureThreshold: { type: Number, required: true, min: 1, default: 5 },
    successThreshold: { type: Number, required: true, min: 1, default: 2 },
    timeoutMs: { type: Number, required: true, min: 1000, default: 60000 },
    halfOpenMaxRequests: { type: Number, required: true, min: 1, default: 3 },
    failureCount: { type: Number, min: 0, default: 0 },
    successCount: { type: Number, min: 0, default: 0 },
    totalRequests: { type: Number, min: 0, default: 0 },
    failedRequests: { type: Number, min: 0, default: 0 },
    openedAt: { type: Date },
    nextProbeAt: { type: Date, index: true },
    lastStateChangeAt: { type: Date },
    lastFailureAt: { type: Date },
    halfOpenLeaseOwner: { type: String },
    halfOpenLeaseExpiresAt: { type: Date },
    version: { type: Number, required: true, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

circuitBreakerStateSchema.index(
  { providerId: 1, operationType: 1 },
  { unique: true },
);
circuitBreakerStateSchema.index({ state: 1, nextProbeAt: 1 });

export const CircuitBreakerState =
  mongoose.models.CircuitBreakerState ??
  mongoose.model("CircuitBreakerState", circuitBreakerStateSchema);

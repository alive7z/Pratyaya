import mongoose from "mongoose";
import {
  PROVIDER_IDS,
  PROVIDER_STATUS,
  SUPPORTED_CURRENCIES,
} from "@pratyaya/shared";

const transactionCostSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["fixed", "percentage", "tiered"],
      required: true,
    },
    fixedMinor: { type: mongoose.Schema.Types.BigInt, min: 0n },
    percentageBps: { type: Number, min: 0, max: 10000 },
    tiers: [
      {
        minAmountMinor: { type: mongoose.Schema.Types.BigInt, min: 0n },
        maxAmountMinor: { type: mongoose.Schema.Types.BigInt },
        fixedMinor: { type: mongoose.Schema.Types.BigInt, min: 0n },
        percentageBps: { type: Number, min: 0, max: 10000 },
      },
    ],
  },
  { _id: false },
);

const paymentProviderSchema = new mongoose.Schema(
  {
    providerId: {
      type: String,
      required: true,
      enum: Object.values(PROVIDER_IDS),
      unique: true,
      index: true,
    },
    providerName: { type: String, required: true, trim: true, maxlength: 100 },
    status: {
      type: String,
      enum: Object.values(PROVIDER_STATUS),
      required: true,
      default: PROVIDER_STATUS.ACTIVE,
      index: true,
    },
    supportedCurrencies: {
      type: [String],
      enum: SUPPORTED_CURRENCIES,
      required: true,
      default: ["USD", "INR"],
    },
    supportedOperations: {
      type: [String],
      enum: ["AUTHORIZE", "CAPTURE", "REFUND"],
      required: true,
      default: ["AUTHORIZE", "CAPTURE", "REFUND"],
    },
    transactionCost: { type: transactionCostSchema, required: true },
    routingWeight: { type: Number, min: 0, max: 1, default: 1 },
    enabled: { type: Boolean, default: true, index: true },
    config: {
      baseUrl: { type: String, required: true },
      hmacSecret: { type: String, required: true },
      timeoutMs: { type: Number, default: 15000, min: 1000 },
      retryAttempts: { type: Number, default: 3, min: 0, max: 5 },
      healthCheckIntervalMs: { type: Number, default: 30000, min: 5000 },
    },
    healthMetrics: {
      availability: { type: Number, min: 0, max: 1 },
      errorRate: { type: Number, min: 0, max: 1 },
      successRate: { type: Number, min: 0, max: 1 },
      timeoutRate: { type: Number, min: 0, max: 1 },
      latencyP50Ms: { type: Number, min: 0 },
      latencyP95Ms: { type: Number, min: 0 },
      latencyP99Ms: { type: Number, min: 0 },
      lastCalculatedAt: { type: Date },
    },
    circuitBreaker: {
      state: {
        type: String,
        enum: ["CLOSED", "OPEN", "HALF_OPEN"],
        default: "CLOSED",
      },
      failureThreshold: { type: Number, default: 5, min: 1 },
      successThreshold: { type: Number, default: 2, min: 1 },
      timeoutMs: { type: Number, default: 60000, min: 5000 },
      halfOpenMaxRequests: { type: Number, default: 3, min: 1 },
      failureCount: { type: Number, default: 0, min: 0 },
      successCount: { type: Number, default: 0, min: 0 },
      openedAt: { type: Date },
      nextProbeAt: { type: Date },
      lastStateChangeAt: { type: Date },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

paymentProviderSchema.index({ status: 1, enabled: 1 });
paymentProviderSchema.index({ "circuitBreaker.state": 1 });

export const PaymentProvider =
  mongoose.models.PaymentProvider ??
  mongoose.model("PaymentProvider", paymentProviderSchema);

export { PROVIDER_IDS, PROVIDER_STATUS };

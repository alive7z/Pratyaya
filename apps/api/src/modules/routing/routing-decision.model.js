import mongoose from "mongoose";
import {
  PROVIDER_IDS,
  OPERATION_TYPES,
  ROUTING_STRATEGIES,
  ROUTING_DECISION_REASON,
} from "@pratyaya/shared";

const scoreBreakdownSchema = new mongoose.Schema(
  {
    providerId: { type: String, required: true },
    reliabilityScore: { type: Number, min: 0, max: 1 },
    latencyScore: { type: Number, min: 0, max: 1 },
    costScore: { type: Number, min: 0, max: 1 },
    weightedScore: { type: Number, min: 0, max: 1 },
    eligibilityReason: { type: String },
  },
  { _id: false },
);

const routingDecisionSchema = new mongoose.Schema(
  {
    decisionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    operationType: {
      type: String,
      enum: Object.values(OPERATION_TYPES),
      required: true,
    },
    amountMinor: {
      type: mongoose.Schema.Types.BigInt,
      required: true,
      min: 1n,
    },
    currency: {
      type: String,
      enum: ["USD", "INR"],
      required: true,
    },
    selectedProviderId: {
      type: String,
      enum: Object.values(PROVIDER_IDS),
    },
    eligibleProviders: [{ type: String, enum: Object.values(PROVIDER_IDS) }],
    rejectedProviders: [
      {
        providerId: { type: String, enum: Object.values(PROVIDER_IDS) },
        reason: { type: String, required: true },
      },
    ],
    routingStrategy: {
      type: String,
      enum: Object.values(ROUTING_STRATEGIES),
      required: true,
    },
    scoreBreakdown: [scoreBreakdownSchema],
    policyVersion: { type: String, required: true },
    decisionReason: {
      type: String,
      enum: Object.values(ROUTING_DECISION_REASON),
      required: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false },
);

routingDecisionSchema.index({ merchantId: 1, createdAt: -1 });
routingDecisionSchema.index({ paymentId: 1 });
routingDecisionSchema.index({ selectedProviderId: 1, createdAt: -1 });
routingDecisionSchema.index({ routingStrategy: 1 });

export const RoutingDecision =
  mongoose.models.RoutingDecision ??
  mongoose.model("RoutingDecision", routingDecisionSchema);

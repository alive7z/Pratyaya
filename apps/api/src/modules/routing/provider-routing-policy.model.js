import mongoose from "mongoose";
import { PROVIDER_IDS, ROUTING_STRATEGIES } from "@pratyaya/shared";

const routingPolicySchema = new mongoose.Schema(
  {
    policyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ["global", "merchant"],
      required: true,
      default: "merchant",
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      index: true,
    },
    strategy: {
      type: String,
      enum: Object.values(ROUTING_STRATEGIES),
      required: true,
      default: ROUTING_STRATEGIES.BALANCED_ADAPTIVE,
    },
    allowedProviderIds: {
      type: [String],
      enum: Object.values(PROVIDER_IDS),
      required: true,
      default: Object.values(PROVIDER_IDS),
    },
    preferredProviderId: {
      type: String,
      enum: Object.values(PROVIDER_IDS),
    },
    weights: {
      reliability: { type: Number, min: 0, max: 100, default: 50 },
      latency: { type: Number, min: 0, max: 100, default: 30 },
      cost: { type: Number, min: 0, max: 100, default: 20 },
    },
    minimumHealthThreshold: { type: Number, min: 0, max: 1, default: 0.95 },
    fallbackEnabled: { type: Boolean, default: true },
    circuitBreakerEnabled: { type: Boolean, default: true },
    stickinessEnabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

routingPolicySchema.index({ scope: 1, merchantId: 1, isActive: 1 });
routingPolicySchema.index({ strategy: 1 });

export const ProviderRoutingPolicy =
  mongoose.models.ProviderRoutingPolicy ??
  mongoose.model("ProviderRoutingPolicy", routingPolicySchema);

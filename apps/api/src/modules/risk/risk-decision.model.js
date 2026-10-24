import mongoose from "mongoose";
import { RISK_DECISION, RISK_LEVEL } from "@pratyaya/shared";

const riskDecisionSchema = new mongoose.Schema(
  {
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
    decision: {
      type: String,
      enum: Object.values(RISK_DECISION),
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    level: {
      type: String,
      enum: Object.values(RISK_LEVEL),
      required: true,
      index: true,
    },
    ruleCodes: {
      type: [String],
      default: [],
    },
    explanation: {
      type: String,
      maxlength: 1000,
    },
    source: {
      type: String,
      enum: ["AUTOMATED", "MANUAL", "RULE_ENGINE"],
      default: "AUTOMATED",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: { type: Date },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

riskDecisionSchema.index({ merchantId: 1, createdAt: -1 });
riskDecisionSchema.index({ paymentId: 1 });
riskDecisionSchema.index({ decision: 1, level: 1 });
riskDecisionSchema.index({ merchantId: 1, decision: 1, createdAt: -1 });

export const RiskDecision =
  mongoose.models.RiskDecision ??
  mongoose.model("RiskDecision", riskDecisionSchema);

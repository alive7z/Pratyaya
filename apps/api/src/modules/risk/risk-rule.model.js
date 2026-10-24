import mongoose from "mongoose";

const riskRuleSchema = new mongoose.Schema(
  {
    ruleCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: Object.values([
        "VELOCITY",
        "AMOUNT_ANOMALY",
        "FAILED_ATTEMPTS",
        "PATTERN",
        "GEOGRAPHIC",
        "CUSTOM",
      ]),
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(["ALLOW", "REVIEW", "BLOCK", "SCORE_INCREMENT"]),
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      required: true,
    },
    scoreIncrement: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    conditions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

riskRuleSchema.index({ type: 1, isActive: 1 });
riskRuleSchema.index({ priority: -1 });

export const RiskRule =
  mongoose.models.RiskRule ?? mongoose.model("RiskRule", riskRuleSchema);

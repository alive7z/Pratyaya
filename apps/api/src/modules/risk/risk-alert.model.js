import mongoose from "mongoose";

const timelineEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    label: { type: String, required: true, maxlength: 120 },
    detail: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const riskAlertSchema = new mongoose.Schema(
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
      index: true,
    },
    reference: { type: String, required: true, maxlength: 100 },
    score: { type: Number, required: true, min: 0, max: 100 },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_REVIEW", "ESCALATED", "CLEARED"],
      default: "OPEN",
      index: true,
    },
    ruleCode: { type: String, required: true, maxlength: 80 },
    summary: { type: String, required: true, maxlength: 300 },
    explanation: { type: String, required: true, maxlength: 1000 },
    signals: { type: [String], default: [] },
    timeline: { type: [timelineEntrySchema], default: [] },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

riskAlertSchema.index({ merchantId: 1, createdAt: -1 });
riskAlertSchema.index({ severity: 1, status: 1 });

export const RiskAlert =
  mongoose.models.RiskAlert ?? mongoose.model("RiskAlert", riskAlertSchema);

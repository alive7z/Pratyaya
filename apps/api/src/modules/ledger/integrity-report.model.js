import mongoose from "mongoose";

const checkSchema = new mongoose.Schema(
  {
    checkId: { type: String, required: true },
    checkName: { type: String, required: true },
    status: {
      type: String,
      enum: ["PASS", "FAIL", "INCONCLUSIVE"],
      required: true,
    },
    affectedRecords: { type: Number, required: true, min: 0 },
    severity: {
      type: String,
      enum: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
    },
    executedAt: { type: Date, required: true },
    diagnostics: { type: mongoose.Schema.Types.Mixed },
    remediation: { type: String, required: true },
  },
  { _id: false },
);

const integrityReportSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    currency: { type: String },
    status: {
      type: String,
      enum: ["PASS", "FAIL", "INCONCLUSIVE"],
      required: true,
    },
    summary: {
      passed: { type: Number, required: true },
      failed: { type: Number, required: true },
      inconclusive: { type: Number, required: true },
      bySeverity: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    checks: { type: [checkSchema], required: true },
    requestedBy: { type: String, required: true },
    requestId: { type: String },
    isDemo: { type: Boolean, default: false, index: true },
    executedAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

integrityReportSchema.index({ merchantId: 1, executedAt: -1, _id: -1 });

export const IntegrityReport =
  mongoose.models.IntegrityReport ??
  mongoose.model("IntegrityReport", integrityReportSchema);

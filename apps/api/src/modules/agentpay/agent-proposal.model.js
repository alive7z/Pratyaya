import mongoose from "mongoose";

const proposalSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    invoiceId: {
      type: String,
      required: true,
      maxlength: 120,
      index: true,
    },
    invoiceText: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    extractedData: {
      supplierName: { type: String, trim: true, maxlength: 200 },
      supplierNormalized: { type: String, trim: true, maxlength: 200 },
      amountMinor: { type: mongoose.Schema.Types.BigInt, min: 1n },
      currency: { type: String, enum: ["USD", "INR"] },
      invoiceNumber: { type: String, trim: true, maxlength: 100 },
      paymentPurpose: { type: String, trim: true, maxlength: 500 },
      invoiceDate: { type: Date },
      dueDate: { type: Date },
      lineItems: [
        {
          description: { type: String, maxlength: 300 },
          quantity: { type: Number },
          unitPriceMinor: { type: mongoose.Schema.Types.BigInt },
          totalMinor: { type: mongoose.Schema.Types.BigInt },
        },
      ],
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    extractionMethod: {
      type: String,
      enum: ["LOCAL", "LLM", "HYBRID"],
      default: "LOCAL",
    },
    status: {
      type: String,
      enum: [
        "PENDING_EXTRACTION",
        "EXTRACTED",
        "POLICY_CHECK_FAILED",
        "RISK_CHECK_FAILED",
        "AWAITING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "EXECUTED",
        "EXPIRED",
      ],
      default: "PENDING_EXTRACTION",
      index: true,
    },
    policyCheck: {
      passed: { type: Boolean },
      reasons: [{ type: String, maxlength: 240 }],
      spendingLimitCheck: { type: Boolean },
      approvedSupplierCheck: { type: Boolean },
      duplicateCheck: { type: Boolean },
    },
    riskCheck: {
      passed: { type: Boolean },
      riskScore: { type: Number, min: 0, max: 100 },
      riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      riskDecision: { type: String, enum: ["ALLOW", "REVIEW", "BLOCK"] },
      riskDecisionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RiskDecision",
      },
    },
    approval: {
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approvedAt: { type: Date },
      rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rejectedAt: { type: Date },
      rejectionReason: { type: String, maxlength: 500 },
    },
    execution: {
      paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
      executedAt: { type: Date },
      executedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      executionError: { type: String, maxlength: 500 },
    },
    idempotencyKey: {
      type: String,
      maxlength: 255,
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
    version: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

proposalSchema.index({ merchantId: 1, invoiceId: 1 }, { unique: true });
proposalSchema.index({ merchantId: 1, status: 1, createdAt: -1 });
proposalSchema.index({
  merchantId: 1,
  "extractedData.supplierNormalized": 1,
  "extractedData.invoiceNumber": 1,
});

export const AgentProposal =
  mongoose.models.AgentProposal ??
  mongoose.model("AgentProposal", proposalSchema);

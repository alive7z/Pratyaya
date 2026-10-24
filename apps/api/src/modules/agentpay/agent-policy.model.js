import mongoose from "mongoose";

const approvedSupplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    taxId: { type: String, trim: true, maxlength: 100 },
    accountNumber: { type: String, trim: true, maxlength: 100 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const spendingLimitSchema = new mongoose.Schema(
  {
    currency: { type: String, enum: ["USD", "INR"], required: true },
    maxAmountMinor: {
      type: mongoose.Schema.Types.BigInt,
      required: true,
      min: 1n,
    },
    period: {
      type: String,
      enum: ["PER_INVOICE", "DAILY", "WEEKLY", "MONTHLY"],
      required: true,
    },
    currentUsageMinor: {
      type: mongoose.Schema.Types.BigInt,
      default: 0n,
      min: 0n,
    },
    periodStart: { type: Date },
    periodEnd: { type: Date },
  },
  { _id: false },
);

const policySchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      unique: true,
      index: true,
    },
    isEnabled: { type: Boolean, default: false, index: true },
    requireHumanApproval: { type: Boolean, default: true },
    autoApproveBelowMinor: { type: mongoose.Schema.Types.BigInt, default: 0n },
    approvedSuppliers: [approvedSupplierSchema],
    spendingLimits: [spendingLimitSchema],
    blockedSuppliers: [
      {
        name: { type: String, trim: true, maxlength: 200 },
        normalizedName: {
          type: String,
          trim: true,
          lowercase: true,
          maxlength: 200,
        },
        reason: { type: String, maxlength: 240 },
      },
    ],
    allowedCurrencies: {
      type: [String],
      enum: ["USD", "INR"],
      default: ["USD", "INR"],
    },
    maxInvoiceAgeDays: { type: Number, min: 1, max: 365, default: 90 },
    allowedPaymentPurposes: [{ type: String, trim: true, maxlength: 200 }],
    version: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

export const AgentPolicy =
  mongoose.models.AgentPolicy ?? mongoose.model("AgentPolicy", policySchema);

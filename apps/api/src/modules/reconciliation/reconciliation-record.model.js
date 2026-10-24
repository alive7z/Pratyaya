import mongoose from "mongoose";
import { SUPPORTED_CURRENCIES } from "@pratyaya/shared";

export const RECONCILIATION_RECORD_STATUS = Object.freeze([
  "MATCHED",
  "MISSING_INTERNAL_RECORD",
  "MISSING_PROVIDER_RECORD",
  "AMOUNT_MISMATCH",
  "STATUS_MISMATCH",
  "PENDING_REVIEW",
  "RESOLVED",
]);

export const RECONCILIATION_CASE_STATUS = Object.freeze([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "MANUAL_REVIEW",
]);

const reconciliationRecordSchema = new mongoose.Schema(
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
    providerReference: { type: String, trim: true, maxlength: 160 },
    internalPaymentStatus: { type: String },
    externalProviderStatus: { type: String },
    expectedAmountMinor: { type: mongoose.Schema.Types.BigInt, min: 0n },
    observedAmountMinor: { type: mongoose.Schema.Types.BigInt, min: 0n },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, required: true },
    status: {
      type: String,
      enum: RECONCILIATION_RECORD_STATUS,
      required: true,
      index: true,
    },
    attemptCount: { type: Number, default: 0, min: 0 },
    lastCheckedAt: { type: Date },
    resolutionMetadata: { type: mongoose.Schema.Types.Mixed },
    isSyntheticFixture: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

reconciliationRecordSchema.index({
  merchantId: 1,
  status: 1,
  createdAt: -1,
  _id: -1,
});
reconciliationRecordSchema.index(
  { merchantId: 1, providerReference: 1 },
  {
    unique: true,
    partialFilterExpression: { providerReference: { $type: "string" } },
  },
);

export const ReconciliationRecord =
  mongoose.models.ReconciliationRecord ??
  mongoose.model("ReconciliationRecord", reconciliationRecordSchema);

const reconciliationCaseSchema = new mongoose.Schema(
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
    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      index: true,
    },
    type: { type: String, enum: ["PAYMENT", "REFUND"], required: true },
    status: {
      type: String,
      enum: RECONCILIATION_CASE_STATUS,
      required: true,
      default: "OPEN",
      index: true,
    },
    discrepancies: [{ type: mongoose.Schema.Types.Mixed }],
    resolutionAction: { type: String, trim: true, maxlength: 120 },
    resolutionMetadata: { type: mongoose.Schema.Types.Mixed },
    attemptCount: { type: Number, default: 0, min: 0 },
    lastCheckedAt: { type: Date },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

reconciliationCaseSchema.index({ merchantId: 1, status: 1, createdAt: -1 });
reconciliationCaseSchema.index({ merchantId: 1, paymentId: 1, status: 1 });

export const ReconciliationCase =
  mongoose.models.ReconciliationCase ??
  mongoose.model("ReconciliationCase", reconciliationCaseSchema);

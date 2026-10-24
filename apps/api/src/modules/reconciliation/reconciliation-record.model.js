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

import mongoose from "mongoose";
import { OPERATION_TYPES, OPERATION_STATES } from "@pratyaya/shared";

const providerOperationSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(OPERATION_TYPES),
      required: true,
      index: true,
    },
    providerOperationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 64,
    },
    clientOperationId: {
      type: String,
      required: true,
      index: true,
      maxlength: 64,
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
    state: {
      type: String,
      enum: Object.values(OPERATION_STATES),
      required: true,
      default: OPERATION_STATES.PENDING,
      index: true,
    },
    stateReason: { type: String, maxlength: 240 },
    requestPayload: { type: mongoose.Schema.Types.Mixed, required: true },
    responsePayload: { type: mongoose.Schema.Types.Mixed },
    providerReference: { type: String, maxlength: 100 },
    idempotencyKey: { type: String, maxlength: 255 },
    attemptCount: { type: Number, default: 0, min: 0 },
    lastAttemptAt: { type: Date },
    nextRetryAt: { type: Date, index: true },
    faultInjected: { type: String, maxlength: 64 },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

providerOperationSchema.index({ merchantId: 1, createdAt: -1 });
providerOperationSchema.index({ paymentId: 1, createdAt: -1 });
providerOperationSchema.index({ state: 1, nextRetryAt: 1 });

export const ProviderOperation =
  mongoose.models.ProviderOperation ??
  mongoose.model("ProviderOperation", providerOperationSchema);

export { OPERATION_TYPES, OPERATION_STATES };

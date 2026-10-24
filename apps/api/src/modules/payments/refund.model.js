import mongoose from "mongoose";
import { REFUND_STATUS } from "@pratyaya/shared";

const refundSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
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
    reason: { type: String, maxlength: 240 },
    status: {
      type: String,
      enum: Object.values(REFUND_STATUS),
      required: true,
      default: REFUND_STATUS.REQUESTED,
      index: true,
    },
    statusReason: { type: String, maxlength: 240 },
    idempotencyKey: { type: String, maxlength: 255 },
    providerOperationId: { type: String, maxlength: 64, index: true },
    providerReference: { type: String, maxlength: 100 },
    reservedMinor: { type: mongoose.Schema.Types.BigInt, default: 0n },
    confirmedMinor: { type: mongoose.Schema.Types.BigInt, default: 0n },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    confirmedAt: { type: Date },
    failedAt: { type: Date },
    failureMetadata: { type: mongoose.Schema.Types.Mixed },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

refundSchema.index({ merchantId: 1, createdAt: -1 });
refundSchema.index({ paymentId: 1, createdAt: -1 });
refundSchema.index({ merchantId: 1, idempotencyKey: 1 }, { unique: true });

export const Refund =
  mongoose.models.Refund ?? mongoose.model("Refund", refundSchema);

export { REFUND_STATUS };

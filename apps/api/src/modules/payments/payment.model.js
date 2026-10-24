import mongoose from "mongoose";
import { PAYMENT_STATUS, SUPPORTED_CURRENCIES } from "@pratyaya/shared";

const paymentSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    customerReference: { type: String, trim: true, maxlength: 120 },
    customerLabel: { type: String, trim: true, maxlength: 120 },
    amountMinor: {
      type: mongoose.Schema.Types.BigInt,
      required: true,
      min: 1n,
    },
    capturedMinor: {
      type: mongoose.Schema.Types.BigInt,
      default: 0n,
      min: 0n,
    },
    refundedMinor: {
      type: mongoose.Schema.Types.BigInt,
      default: 0n,
      min: 0n,
    },
    currency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      required: true,
      index: true,
    },
    statusReason: { type: String, maxlength: 240 },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    description: { type: String, maxlength: 500 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    cancelledAt: { type: Date },
    isDemo: { type: Boolean, default: false, index: true },
    version: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

paymentSchema.index({ merchantId: 1, createdAt: -1, _id: -1 });
paymentSchema.index({ merchantId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ merchantId: 1, reference: 1 }, { unique: true });

export const Payment =
  mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema);

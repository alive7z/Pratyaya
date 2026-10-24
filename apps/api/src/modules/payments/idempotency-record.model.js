import mongoose from "mongoose";
import { IDEMPOTENCY_OPERATIONS, IDEMPOTENCY_STATE } from "@pratyaya/shared";

const idempotencyRecordSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    operation: {
      type: String,
      enum: Object.values(IDEMPOTENCY_OPERATIONS),
      required: true,
    },
    keyHash: { type: String, required: true },
    requestFingerprint: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(IDEMPOTENCY_STATE),
      required: true,
      default: IDEMPOTENCY_STATE.IN_PROGRESS,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
    },
    responseStatus: { type: Number },
    responseBody: { type: mongoose.Schema.Types.Mixed },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date },
    failedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

idempotencyRecordSchema.index(
  { merchantId: 1, operation: 1, keyHash: 1 },
  { unique: true },
);
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
idempotencyRecordSchema.index({ status: 1, updatedAt: 1 });

export const IdempotencyRecord =
  mongoose.models.IdempotencyRecord ??
  mongoose.model("IdempotencyRecord", idempotencyRecordSchema);

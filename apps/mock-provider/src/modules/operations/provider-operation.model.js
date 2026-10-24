import mongoose from "mongoose";

const PROVIDER_OPERATION_TYPES = Object.freeze({
  AUTHORIZATION: "AUTHORIZATION",
  CAPTURE: "CAPTURE",
  REFUND: "REFUND",
  VOID: "VOID",
});

const PROVIDER_OPERATION_STATUS = Object.freeze({
  RECEIVED: "RECEIVED",
  PROCESSING: "PROCESSING",
  SUCCEEDED: "SUCCEEDED",
  DECLINED: "DECLINED",
  UNKNOWN_TO_CLIENT: "UNKNOWN_TO_CLIENT",
});

const providerOperationSchema = new mongoose.Schema(
  {
    providerId: {
      type: String,
      enum: ["alpha", "beta", "gamma"],
      required: true,
      index: true,
    },
    operationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 64,
    },
    type: {
      type: String,
      enum: Object.values(PROVIDER_OPERATION_TYPES),
      required: true,
      index: true,
    },
    clientOperationId: {
      type: String,
      required: true,
      index: true,
      maxlength: 64,
    },
    merchantId: {
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
    status: {
      type: String,
      enum: Object.values(PROVIDER_OPERATION_STATUS),
      required: true,
      default: PROVIDER_OPERATION_STATUS.RECEIVED,
      index: true,
    },
    statusReason: { type: String, maxlength: 240 },
    requestPayload: { type: mongoose.Schema.Types.Mixed, required: true },
    responsePayload: { type: mongoose.Schema.Types.Mixed },
    providerReference: { type: String, maxlength: 100 },
    idempotencyKey: {
      type: String,
      required: true,
      index: true,
      maxlength: 255,
    },
    requestFingerprint: {
      type: String,
      required: true,
      maxlength: 64,
    },
    faultInjected: { type: String, maxlength: 64 },
    processingStartedAt: { type: Date },
    processingCompletedAt: { type: Date },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

providerOperationSchema.index({ merchantId: 1, createdAt: -1 });
providerOperationSchema.index({ clientOperationId: 1, type: 1 });
providerOperationSchema.index(
  { providerId: 1, type: 1, idempotencyKey: 1 },
  { unique: true },
);

export const ProviderOperation =
  mongoose.models.ProviderOperation ??
  mongoose.model("ProviderOperation", providerOperationSchema);

export { PROVIDER_OPERATION_TYPES, PROVIDER_OPERATION_STATUS };

import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    providerEventId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true, maxlength: 80 },
    status: {
      type: String,
      enum: ["DELIVERED", "RETRYING", "FAILED", "RECEIVED"],
      required: true,
      index: true,
    },
    signatureValid: { type: Boolean, default: false },
    payloadPreview: { type: mongoose.Schema.Types.Mixed },
    deliveredAt: { type: Date },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

webhookEventSchema.index({ merchantId: 1, createdAt: -1 });

export const WebhookEvent =
  mongoose.models.WebhookEvent ??
  mongoose.model("WebhookEvent", webhookEventSchema);

const apiRequestLogSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    method: { type: String, required: true, maxlength: 10 },
    path: { type: String, required: true, maxlength: 200 },
    statusCode: { type: Number, required: true },
    latencyMs: { type: Number, required: true, min: 0 },
    requestId: { type: String, required: true, maxlength: 128 },
    idempotencyResult: {
      type: String,
      enum: ["NEW", "REPLAYED", "CONFLICT"],
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

apiRequestLogSchema.index({ merchantId: 1, createdAt: -1 });

export const ApiRequestLog =
  mongoose.models.ApiRequestLog ??
  mongoose.model("ApiRequestLog", apiRequestLogSchema);

const reconciliationCaseSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    caseNumber: { type: String, required: true, unique: true },
    reason: { type: String, required: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "MANUAL_REVIEW"],
      required: true,
      index: true,
    },
    expectedMinor: { type: mongoose.Schema.Types.BigInt },
    observedMinor: { type: mongoose.Schema.Types.BigInt },
    currency: { type: String, enum: ["USD", "INR"], default: "USD" },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

export const ReconciliationCase =
  mongoose.models.ReconciliationCase ??
  mongoose.model("ReconciliationCase", reconciliationCaseSchema);

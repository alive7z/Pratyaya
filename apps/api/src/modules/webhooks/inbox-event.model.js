import mongoose from "mongoose";

const inboxEventSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      enum: ["mock-provider"],
      index: true,
    },
    providerEventId: {
      type: String,
      required: true,
      maxlength: 64,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      maxlength: 64,
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
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    payloadDigest: {
      type: String,
      required: true,
      maxlength: 64,
    },
    signatureVerified: { type: Boolean, required: true, default: false },
    signatureError: { type: String, maxlength: 240 },
    receivedAt: { type: Date, default: Date.now, index: true },
    processedAt: { type: Date },
    processingStatus: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    attemptCount: { type: Number, default: 0 },
    lastError: { type: String, maxlength: 500 },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

inboxEventSchema.index({ source: 1, providerEventId: 1 }, { unique: true });
inboxEventSchema.index({ merchantId: 1, receivedAt: -1 });
inboxEventSchema.index({ processingStatus: 1, receivedAt: 1 });

export const InboxEvent =
  mongoose.models.InboxEvent ?? mongoose.model("InboxEvent", inboxEventSchema);

import mongoose from "mongoose";

const paymentEventSchema = new mongoose.Schema(
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
    eventType: { type: String, required: true, maxlength: 80 },
    fromStatus: { type: String },
    toStatus: { type: String },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    actorRole: { type: String, maxlength: 40 },
    summary: { type: String, required: true, maxlength: 240 },
    metadata: { type: mongoose.Schema.Types.Mixed },
    isDemo: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

paymentEventSchema.index({ paymentId: 1, createdAt: 1, _id: 1 });
paymentEventSchema.index({ merchantId: 1, createdAt: -1 });

export const PaymentEvent =
  mongoose.models.PaymentEvent ??
  mongoose.model("PaymentEvent", paymentEventSchema);

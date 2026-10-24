import mongoose from "mongoose";
import { OUTBOX_EVENT_TYPES, OUTBOX_STATE } from "@pratyaya/shared";

const outboxEventSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    aggregateType: {
      type: String,
      required: true,
      enum: ["payment", "journal", "integrity_report"],
      default: "payment",
    },
    aggregateId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: Object.values(OUTBOX_EVENT_TYPES),
      required: true,
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    state: {
      type: String,
      enum: Object.values(OUTBOX_STATE),
      required: true,
      default: OUTBOX_STATE.PENDING,
      index: true,
    },
    attempts: { type: Number, default: 0 },
    availableAt: { type: Date, default: Date.now, index: true },
    leaseUntil: { type: Date, index: true },
    leaseOwner: { type: String, maxlength: 64 },
    leasedAt: { type: Date },
    dispatchedAt: { type: Date },
    failedAt: { type: Date },
    error: { type: String, maxlength: 500 },
    idempotencyKeyHash: { type: String },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

outboxEventSchema.index({ state: 1, availableAt: 1, leaseUntil: 1, _id: 1 });
outboxEventSchema.index({ merchantId: 1, aggregateId: 1, createdAt: 1 });

export const OutboxEvent =
  mongoose.models.OutboxEvent ??
  mongoose.model("OutboxEvent", outboxEventSchema);

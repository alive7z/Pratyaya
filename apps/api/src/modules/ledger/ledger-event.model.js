import mongoose from "mongoose";

const ledgerEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, immutable: true },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      immutable: true,
      index: true,
    },
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      required: true,
      immutable: true,
    },
    journalReference: { type: String, required: true, immutable: true },
    eventType: { type: String, required: true, immutable: true },
    actor: { type: String, required: true, immutable: true },
    requestId: { type: String, immutable: true },
    metadata: { type: mongoose.Schema.Types.Mixed, immutable: true },
    occurredAt: { type: Date, default: Date.now, immutable: true },
    isDemo: { type: Boolean, default: false, immutable: true },
  },
  { versionKey: false },
);

ledgerEventSchema.index({ merchantId: 1, occurredAt: -1 });

export const LedgerEvent =
  mongoose.models.LedgerEvent ??
  mongoose.model("LedgerEvent", ledgerEventSchema);

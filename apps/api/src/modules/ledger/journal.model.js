import mongoose from "mongoose";
import {
  LEDGER_EVENT_TYPES,
  LEDGER_SIDES,
  SUPPORTED_CURRENCIES,
} from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";

const journalEntrySchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
      required: true,
    },
    direction: {
      type: String,
      enum: Object.values(LEDGER_SIDES),
      required: true,
    },
    amountMinor: {
      type: mongoose.Schema.Types.BigInt,
      required: true,
      min: 1n,
    },
    description: { type: String, trim: true, maxlength: 240 },
  },
  { _id: false },
);

const journalSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      immutable: true,
      index: true,
    },
    journalReference: {
      type: String,
      required: true,
      immutable: true,
      unique: true,
      maxlength: 100,
    },
    sourceType: {
      type: String,
      required: true,
      immutable: true,
      maxlength: 64,
    },
    sourceId: { type: String, required: true, immutable: true, maxlength: 120 },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      immutable: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: Object.values(LEDGER_EVENT_TYPES),
      required: true,
      immutable: true,
    },
    currency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["POSTED"],
      default: "POSTED",
      immutable: true,
    },
    entries: {
      type: [journalEntrySchema],
      required: true,
      immutable: true,
      validate: {
        validator: (entries) => Array.isArray(entries) && entries.length >= 2,
        message: "A journal requires at least two entries",
      },
    },
    description: { type: String, trim: true, maxlength: 500, immutable: true },
    postedAt: { type: Date, required: true, immutable: true },
    createdBy: {
      type: String,
      required: true,
      immutable: true,
      maxlength: 120,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, immutable: true },
    reversalOfJournalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      immutable: true,
    },
    isDemo: { type: Boolean, default: false, immutable: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

journalSchema.index(
  { merchantId: 1, sourceType: 1, sourceId: 1, eventType: 1 },
  { unique: true },
);
journalSchema.index({ merchantId: 1, currency: 1, postedAt: -1, _id: -1 });
journalSchema.index({ merchantId: 1, paymentId: 1, postedAt: -1 });
journalSchema.index({ merchantId: 1, "entries.accountId": 1, postedAt: -1 });
journalSchema.index({ merchantId: 1, reversalOfJournalId: 1, postedAt: 1 });

function immutableError() {
  return new AppError(
    409,
    "POSTED_JOURNAL_IMMUTABLE",
    "Posted journals cannot be changed or deleted; post a compensating journal",
  );
}

journalSchema.pre(
  [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
  ],
  function () {
    throw immutableError();
  },
);

journalSchema.pre("save", function () {
  if (!this.isNew) throw immutableError();
});

export const Journal =
  mongoose.models.Journal ?? mongoose.model("Journal", journalSchema);

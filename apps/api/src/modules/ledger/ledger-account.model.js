import mongoose from "mongoose";
import {
  LEDGER_ACCOUNT_TYPES,
  LEDGER_NORMAL_BALANCES,
  SUPPORTED_CURRENCIES,
} from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";

const ledgerAccountSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
      immutable: true,
    },
    accountCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      immutable: true,
    },
    accountName: { type: String, required: true, trim: true, maxlength: 120 },
    accountType: {
      type: String,
      enum: Object.values(LEDGER_ACCOUNT_TYPES),
      required: true,
      immutable: true,
    },
    currency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      required: true,
      immutable: true,
    },
    normalBalance: {
      type: String,
      enum: Object.values(LEDGER_NORMAL_BALANCES),
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

ledgerAccountSchema.index(
  { merchantId: 1, accountCode: 1, currency: 1 },
  { unique: true },
);
ledgerAccountSchema.index({ merchantId: 1, currency: 1, status: 1 });

const criticalFields = new Set([
  "merchantId",
  "accountCode",
  "accountType",
  "currency",
  "normalBalance",
]);

ledgerAccountSchema.pre(
  ["updateOne", "findOneAndUpdate", "replaceOne"],
  function () {
    const update = this.getUpdate() ?? {};
    const touched = new Set([
      ...Object.keys(update),
      ...Object.keys(update.$set ?? {}),
      ...Object.keys(update.$unset ?? {}),
    ]);
    if ([...criticalFields].some((field) => touched.has(field))) {
      throw new AppError(
        409,
        "LEDGER_ACCOUNT_IMMUTABLE",
        "Accounting-critical account fields cannot be changed",
      );
    }
  },
);

export const LedgerAccount =
  mongoose.models.LedgerAccount ??
  mongoose.model("LedgerAccount", ledgerAccountSchema);

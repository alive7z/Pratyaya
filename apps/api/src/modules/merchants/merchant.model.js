import mongoose from "mongoose";
import { ROLES } from "@pratyaya/shared";

const merchantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    currency: { type: String, enum: ["USD", "INR"], default: "USD" },
    isDemo: { type: Boolean, default: false, index: true },
    demoAnchorRole: {
      type: String,
      enum: Object.values(ROLES),
      default: undefined,
    },
  },
  { timestamps: true, versionKey: false },
);

merchantSchema.index({ isDemo: 1, status: 1 });

export const Merchant =
  mongoose.models.Merchant ?? mongoose.model("Merchant", merchantSchema);

const membershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    role: { type: String, enum: Object.values(ROLES), required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "INVITED", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

membershipSchema.index({ userId: 1, merchantId: 1 }, { unique: true });
membershipSchema.index({ merchantId: 1, role: 1, status: 1 });

export const Membership =
  mongoose.models.Membership ?? mongoose.model("Membership", membershipSchema);

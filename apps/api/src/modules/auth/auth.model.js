import mongoose from "mongoose";
import { ROLES } from "@pratyaya/shared";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
    isCredentialless: { type: Boolean, default: false },
    demoRole: { type: String, enum: Object.values(ROLES) },
    demoExpiresAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ isDemo: 1, demoRole: 1 });

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);

const sessionSchema = new mongoose.Schema(
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
    familyId: { type: String, required: true, index: true },
    refreshTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: { type: Date, required: true },
    demoExpiresAt: { type: Date },
    revokedAt: { type: Date, index: true },
    replacedBySessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    lastUsedAt: { type: Date, default: Date.now },
    ipHash: { type: String },
    userAgent: { type: String, maxlength: 256 },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
sessionSchema.index({ isDemo: 1, ipHash: 1, createdAt: -1 });

export const Session =
  mongoose.models.Session ?? mongoose.model("Session", sessionSchema);

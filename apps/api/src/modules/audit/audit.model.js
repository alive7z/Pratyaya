import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorRole: { type: String },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      index: true,
    },
    action: { type: String, required: true, index: true },
    outcome: {
      type: String,
      enum: ["SUCCESS", "DENIED", "FAILURE"],
      default: "SUCCESS",
    },
    resourceType: { type: String },
    resourceId: { type: String },
    ipHash: { type: String },
    userAgent: { type: String, maxlength: 256 },
    metadata: { type: mongoose.Schema.Types.Mixed },
    isDemo: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

auditLogSchema.index({ merchantId: 1, createdAt: -1 });

export const AuditLog =
  mongoose.models.AuditLog ?? mongoose.model("AuditLog", auditLogSchema);

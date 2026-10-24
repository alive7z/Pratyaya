import mongoose from "mongoose";

const approvalSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentProposal",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["APPROVE", "REJECT", "REQUEST_CHANGES"],
      required: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    decidedAt: { type: Date, default: Date.now },
    reason: { type: String, maxlength: 500 },
    metadata: {
      originalAmountMinor: { type: mongoose.Schema.Types.BigInt },
      approvedAmountMinor: { type: mongoose.Schema.Types.BigInt },
      originalSupplier: { type: String, maxlength: 200 },
      approvedSupplier: { type: String, maxlength: 200 },
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

approvalSchema.index({ merchantId: 1, proposalId: 1, createdAt: -1 });

export const AgentApproval =
  mongoose.models.AgentApproval ?? mongoose.model("AgentApproval", approvalSchema);
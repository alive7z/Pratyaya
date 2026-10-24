import mongoose from "mongoose";

const agentAuditEventSchema = new mongoose.Schema(
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
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "PROPOSAL_CREATED",
        "EXTRACTION_COMPLETED",
        "EXTRACTION_FAILED",
        "POLICY_CHECK_PASSED",
        "POLICY_CHECK_FAILED",
        "RISK_CHECK_PASSED",
        "RISK_CHECK_FAILED",
        "APPROVAL_REQUESTED",
        "APPROVED",
        "REJECTED",
        "EXECUTION_STARTED",
        "EXECUTION_SUCCEEDED",
        "EXECUTION_FAILED",
        "EXPIRED",
      ],
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    actorRole: { type: String, maxlength: 50 },
    outcome: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "PENDING"],
      default: "SUCCESS",
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
    error: { type: String, maxlength: 500 },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

agentAuditEventSchema.index({ merchantId: 1, proposalId: 1, createdAt: -1 });
agentAuditEventSchema.index({ merchantId: 1, action: 1, createdAt: -1 });

export const AgentAuditEvent =
  mongoose.models.AgentAuditEvent ??
  mongoose.model("AgentAuditEvent", agentAuditEventSchema);

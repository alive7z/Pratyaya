import mongoose from "mongoose";
import { JOB_TYPES, JOB_STATUS } from "@pratyaya/shared";

const jobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 64,
    },
    type: {
      type: String,
      enum: Object.values(JOB_TYPES),
      required: true,
      index: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
    },
    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      index: true,
    },
    sourceEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OutboxEvent",
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      required: true,
      default: JOB_STATUS.PENDING,
      index: true,
    },
    priority: { type: Number, default: 0, min: 0, max: 10 },
    attemptCount: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1, max: 20 },
    nextAttemptAt: { type: Date, index: true },
    leaseOwner: { type: String, maxlength: 64 },
    leaseUntil: { type: Date, index: true },
    leaseToken: { type: String, maxlength: 64 },
    lastError: { type: String, maxlength: 500 },
    errorHistory: [
      {
        attempt: Number,
        error: String,
        timestamp: Date,
      },
    ],
    completedAt: { type: Date },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

jobSchema.index({ status: 1, nextAttemptAt: 1, priority: -1, _id: 1 });
jobSchema.index({ merchantId: 1, createdAt: -1 });
jobSchema.index({ leaseOwner: 1, leaseUntil: 1 });

export const Job = mongoose.models.Job ?? mongoose.model("Job", jobSchema);

export { JOB_TYPES, JOB_STATUS };

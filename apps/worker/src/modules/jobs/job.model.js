import mongoose from "mongoose";
import { JOB_TYPES, JOB_STATUS } from "@pratyaya/shared";

const { Schema } = mongoose;

const jobSchema = new Schema(
  {
    jobId: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 64,
    },

    type: {
      type: String,
      enum: Object.values(JOB_TYPES),
      required: true,
    },

    merchantId: {
      type: Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },

    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    refundId: {
      type: Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
    },

    sourceEventId: {
      type: Schema.Types.ObjectId,
      ref: "OutboxEvent",
      default: null,
    },

    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      required: true,
      default: JOB_STATUS.PENDING,
    },

    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },

    attemptCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    maxAttempts: {
      type: Number,
      required: true,
      default: 5,
      min: 1,
      max: 20,
    },

    nextAttemptAt: {
      type: Date,
      default: Date.now,
    },

    leaseOwner: {
      type: String,
      trim: true,
      maxlength: 64,
      default: null,
    },

    leaseUntil: {
      type: Date,
      default: null,
    },

    leaseToken: {
      type: String,
      maxlength: 64,
      default: null,
    },

    lastAttemptAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      maxlength: 500,
      default: null,
    },

    errorHistory: {
      type: [
        new Schema(
          {
            attempt: {
              type: Number,
              required: true,
              min: 1,
            },
            error: {
              type: String,
              required: true,
              maxlength: 500,
            },
            timestamp: {
              type: Date,
              default: Date.now,
            },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    completedAt: {
      type: Date,
      default: null,
    },

    isDemo: {
      type: Boolean,
      default: false,
    },

    version: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  },
);

jobSchema.index(
  { jobId: 1 },
  {
    unique: true,
  },
);

jobSchema.index(
  {
    status: 1,
    nextAttemptAt: 1,
    priority: -1,
    _id: 1,
  },
  {},
);

jobSchema.index(
  {
    status: 1,
    leaseUntil: 1,
  },
  {
    name: "job_stale_lease",
  },
);

jobSchema.index(
  {
    merchantId: 1,
    createdAt: -1,
  },
  {},
);

jobSchema.index(
  {
    paymentId: 1,
    createdAt: -1,
  },
  {
    name: "job_payment_created",
  },
);

jobSchema.index(
  {
    sourceEventId: 1,
  },
  {
    name: "job_source_event_unique",
    unique: true,
    partialFilterExpression: {
      sourceEventId: { $type: "objectId" },
    },
  },
);

jobSchema.index(
  {
    leaseOwner: 1,
    leaseUntil: 1,
  },
  {
    name: "job_lease_owner",
    partialFilterExpression: {
      leaseOwner: { $type: "string" },
    },
  },
);

export const Job = mongoose.models.Job ?? mongoose.model("Job", jobSchema);

export { JOB_TYPES, JOB_STATUS };

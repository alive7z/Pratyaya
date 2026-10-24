
import mongoose from "mongoose";
import { OUTBOX_EVENT_TYPES, OUTBOX_STATE } from "@pratyaya/shared";

const { Schema } = mongoose;

const outboxEventSchema = new Schema(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },

    aggregateType: {
      type: String,
      enum: ["payment", "journal", "integrity_report"],
      required: true,
      default: "payment",
    },

    aggregateId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    eventType: {
      type: String,
      enum: Object.values(OUTBOX_EVENT_TYPES),
      required: true,
    },

    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },

    state: {
      type: String,
      enum: Object.values(OUTBOX_STATE),
      required: true,
      default: OUTBOX_STATE.PENDING,
    },

    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    availableAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    leaseUntil: {
      type: Date,
      default: null,
    },

    leaseOwner: {
      type: String,
      trim: true,
      maxlength: 64,
      default: null,
    },

    leasedAt: {
      type: Date,
      default: null,
    },

    dispatchedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    error: {
      type: String,
      maxlength: 500,
      default: null,
    },

    idempotencyKeyHash: {
      type: String,
      trim: true,
      maxlength: 128,
    },

    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  },
);

outboxEventSchema.index(
  {
    state: 1,
    availableAt: 1,
    leaseUntil: 1,
    _id: 1,
  },
  {
  },
);

outboxEventSchema.index(
  {
    merchantId: 1,
    aggregateId: 1,
    createdAt: 1,
  },
  {
  },
);

outboxEventSchema.index(
  {
    leaseOwner: 1,
    leaseUntil: 1,
  },
  {
    name: "outbox_lease_owner",
    partialFilterExpression: {
      leaseOwner: { $type: "string" },
    },
  },
);

outboxEventSchema.index(
  {
    eventType: 1,
    createdAt: -1,
  },
  {
    name: "outbox_event_type_created",
  },
);

export const OutboxEvent =
  mongoose.models.OutboxEvent ??
  mongoose.model("OutboxEvent", outboxEventSchema);

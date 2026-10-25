import mongoose from "mongoose";
import {
  OPERATION_TYPES,
  OPERATION_STATES,
  SUPPORTED_CURRENCIES,
} from "@pratyaya/shared";

const { Schema } = mongoose;

const providerOperationSchema = new Schema(
  {
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },

    refundId: {
      type: Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
    },

    merchantId: {
      type: Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },

    type: {
      type: String,
      enum: Object.values(OPERATION_TYPES),
      required: true,
    },

    providerOperationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },

    clientOperationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },

    amountMinor: {
      type: Schema.Types.BigInt,
      required: true,
      min: 1n,
      max: 1_000_000_000_000n,
    },

    currency: {
      type: String,
      enum: Object.values(SUPPORTED_CURRENCIES),
      required: true,
      uppercase: true,
      trim: true,
    },

    state: {
      type: String,
      enum: Object.values(OPERATION_STATES),
      required: true,
      default: OPERATION_STATES.PENDING,
    },

    stateReason: {
      type: String,
      trim: true,
      maxlength: 240,
      default: null,
    },

    requestPayload: {
      type: Schema.Types.Mixed,
      required: true,
    },

    responsePayload: {
      type: Schema.Types.Mixed,
      default: null,
    },

    providerReference: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 255,
      required: true,
    },

    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastAttemptAt: {
      type: Date,
      default: null,
    },

    nextRetryAt: {
      type: Date,
      default: null,
    },

    processingStartedAt: {
      type: Date,
      default: null,
    },

    processingCompletedAt: {
      type: Date,
      default: null,
    },

    faultInjected: {
      type: String,
      trim: true,
      maxlength: 64,
      default: null,
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

providerOperationSchema.index(
  { providerOperationId: 1 },
  {
    unique: true,
    name: "provider_operation_id_unique",
  },
);

providerOperationSchema.index(
  { clientOperationId: 1 },
  {
    unique: true,
    name: "provider_client_operation_id_unique",
  },
);

providerOperationSchema.index(
  { merchantId: 1, type: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: "provider_merchant_type_idempotency_unique",
  },
);

providerOperationSchema.index(
  { merchantId: 1, createdAt: -1 },
  { name: "provider_merchant_created" },
);

providerOperationSchema.index(
  { paymentId: 1, createdAt: -1 },
  { name: "provider_payment_created" },
);

providerOperationSchema.index(
  { paymentId: 1, type: 1, state: 1 },
  { name: "provider_payment_type_state" },
);

providerOperationSchema.index(
  { refundId: 1 },
  {
    name: "provider_refund_id",
    partialFilterExpression: {
      refundId: { $type: "objectId" },
    },
  },
);

providerOperationSchema.index(
  { state: 1, nextRetryAt: 1 },
  { name: "provider_state_retry" },
);

providerOperationSchema.pre("validate", function () {
  if (this.amountMinor != null && this.amountMinor <= 0n) {
    this.invalidate(
      "amountMinor",
      "Operation amount must be greater than zero",
    );
  }

  if (
    this.processingStartedAt &&
    this.processingCompletedAt &&
    this.processingCompletedAt < this.processingStartedAt
  ) {
    this.invalidate(
      "processingCompletedAt",
      "Completion time cannot precede processing start time",
    );
  }
});

export const ProviderOperation =
  mongoose.models.ProviderOperation ??
  mongoose.model("ProviderOperation", providerOperationSchema);

export { OPERATION_TYPES, OPERATION_STATES };

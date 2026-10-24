
import mongoose from "mongoose";

const PROVIDER_IDS = ["alpha", "beta", "gamma"];
const CURRENCIES = ["USD", "INR"];

const PROVIDER_OPERATION_TYPES = Object.freeze({
  AUTHORIZATION: "AUTHORIZATION",
  CAPTURE: "CAPTURE",
  REFUND: "REFUND",
  VOID: "VOID",
});

const PROVIDER_OPERATION_STATUS = Object.freeze({
  RECEIVED: "RECEIVED",
  PROCESSING: "PROCESSING",
  SUCCEEDED: "SUCCEEDED",
  DECLINED: "DECLINED",
  UNKNOWN_TO_CLIENT: "UNKNOWN_TO_CLIENT",
});

const providerOperationSchema = new mongoose.Schema(
  {
    providerId: {
      type: String,
      enum: PROVIDER_IDS,
      required: true,
    },

    operationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      immutable: true,
    },

    type: {
      type: String,
      enum: Object.values(PROVIDER_OPERATION_TYPES),
      required: true,
      immutable: true,
    },

    clientOperationId: {
      type: String,
      required: true,
      maxlength: 64,
      immutable: true,
    },

    merchantId: {
      type: String,
      required: true,
      maxlength: 64,
      immutable: true,
    },

    amountMinor: {
      type: mongoose.Schema.Types.BigInt,
      required: true,
      min: 1n,
      immutable: true,
    },

    currency: {
      type: String,
      enum: CURRENCIES,
      required: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: Object.values(PROVIDER_OPERATION_STATUS),
      default: PROVIDER_OPERATION_STATUS.RECEIVED,
      required: true,
    },

    statusReason: {
      type: String,
      maxlength: 240,
    },

    requestPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      immutable: true,
    },

    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
    },

    providerReference: {
      type: String,
      maxlength: 100,
    },

    idempotencyKey: {
      type: String,
      required: true,
      maxlength: 255,
      immutable: true,
    },

    requestFingerprint: {
      type: String,
      required: true,
      minlength: 64,
      maxlength: 64,
      match: /^[a-fA-F0-9]{64}$/,
      immutable: true,
    },

    faultInjected: {
      type: String,
      maxlength: 64,
    },

    processingStartedAt: Date,
    processingCompletedAt: Date,

    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
    collection: "mockprovideroperations",
  },
);

providerOperationSchema.index(
  { operationId: 1 },
  { unique: true, name: "operation_id_unique" },
);

providerOperationSchema.index(
  { providerId: 1, type: 1, idempotencyKey: 1 },
  { unique: true, name: "provider_type_idempotency_unique" },
);

providerOperationSchema.index(
  { merchantId: 1, createdAt: -1 },
  { name: "merchant_operations_recent" },
);

providerOperationSchema.index(
  { clientOperationId: 1, type: 1 },
  { name: "client_operation_type" },
);

providerOperationSchema.index(
  { providerId: 1, status: 1, createdAt: -1 },
  { name: "provider_status_recent" },
);

providerOperationSchema.index(
  { isDemo: 1, createdAt: -1 },
  { name: "demo_operations_recent" },
);

export const ProviderOperation =
  mongoose.models.ProviderOperation ??
  mongoose.model("ProviderOperation", providerOperationSchema);

export {
  PROVIDER_OPERATION_TYPES,
  PROVIDER_OPERATION_STATUS,
};

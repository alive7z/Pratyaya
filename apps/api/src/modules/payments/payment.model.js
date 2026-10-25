import mongoose from "mongoose";
import { PAYMENT_STATUS, SUPPORTED_CURRENCIES } from "@pratyaya/shared";

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },

    reference: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    customerReference: {
      type: String,
      trim: true,
      maxlength: 120,
    },

    customerLabel: {
      type: String,
      trim: true,
      maxlength: 120,
    },

    amountMinor: {
      type: Schema.Types.BigInt,
      required: true,
      min: 1n,
      max: 1_000_000_000_000n,
    },

    capturedMinor: {
      type: Schema.Types.BigInt,
      required: true,
      default: 0n,
      min: 0n,
    },

    refundedMinor: {
      type: Schema.Types.BigInt,
      required: true,
      default: 0n,
      min: 0n,
    },

    currency: {
      type: String,
      enum: Object.values(SUPPORTED_CURRENCIES),
      required: true,
      uppercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      required: true,
      default: PAYMENT_STATUS.CREATED,
    },

    statusReason: {
      type: String,
      trim: true,
      maxlength: 240,
      default: null,
    },

    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    simulationFault: {
      type: Schema.Types.Mixed,
      default: null,
      select: false,
    },

    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    cancelledAt: {
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
    minimize: true,
  },
);

paymentSchema.index(
  { merchantId: 1, reference: 1 },
  {
    unique: true,
  },
);

paymentSchema.index({ merchantId: 1, createdAt: -1, _id: -1 });

paymentSchema.index({ merchantId: 1, status: 1, createdAt: -1 });

paymentSchema.index(
  { merchantId: 1, isDemo: 1, createdAt: -1 },
  { name: "payment_merchant_demo_created" },
);

paymentSchema.path("metadata").validate({
  validator(value) {
    if (value == null) return true;

    try {
      const serialized = JSON.stringify(value);
      return (
        serialized !== undefined && Buffer.byteLength(serialized) <= 16_384
      );
    } catch {
      return false;
    }
  },
  message: "Payment metadata must be valid JSON under 16 KB",
});

paymentSchema.pre("validate", function () {
  const authorized = this.amountMinor;
  const captured = this.capturedMinor;
  const refunded = this.refundedMinor;

  if (authorized == null || captured == null || refunded == null) {
    return;
  }

  if (authorized <= 0n) {
    this.invalidate("amountMinor", "Payment amount must be greater than zero");
  }

  if (captured < 0n || captured > authorized) {
    this.invalidate(
      "capturedMinor",
      "Captured amount must be between zero and the authorized amount",
    );
  }

  if (refunded < 0n || refunded > captured) {
    this.invalidate(
      "refundedMinor",
      "Refunded amount cannot exceed the captured amount",
    );
  }
});

export const Payment =
  mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema);

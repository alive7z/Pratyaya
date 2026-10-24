import { z } from "zod";
import { MAX_PAYMENT_MINOR_UNITS } from "./money.js";
import { DEMO_ROLES, SUPPORTED_CURRENCIES } from "./constants.js";

const MINOR_UNITS_PATTERN = /^(0|[1-9]\d*)$/;
const PRINTABLE_ASCII_PATTERN = /^[\x21-\x7E]+$/;

export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

export const amountMinorSchema = z
  .string()
  .regex(MINOR_UNITS_PATTERN, "amountMinor must be an integer digit string")
  .refine((value) => {
    if (!MINOR_UNITS_PATTERN.test(value)) return false;
    const minor = BigInt(value);
    return minor > 0n && minor <= MAX_PAYMENT_MINOR_UNITS;
  }, "amountMinor must be greater than zero and within the payment limit");

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency-Key must be at least 8 characters")
  .max(255, "Idempotency-Key must be at most 255 characters")
  .regex(
    PRINTABLE_ASCII_PATTERN,
    "Idempotency-Key must contain printable ASCII characters only",
  );

export const merchantReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[A-Za-z0-9._\-/]+$/,
    "merchantReference contains unsupported characters",
  );

export const customerReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[A-Za-z0-9._\-/ ]+$/,
    "customerReference contains unsupported characters",
  );

export const paymentMetadataSchema = z
  .record(
    z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9._-]+$/),
    z.string().trim().max(200),
  )
  .refine(
    (value) => Object.keys(value).length <= 10,
    "metadata supports at most 10 entries",
  )
  .optional();

export const paymentCreateSchema = z
  .object({
    amountMinor: amountMinorSchema,
    currency: currencySchema,
    description: z.string().trim().min(1).max(500).optional(),
    customerReference: customerReferenceSchema.optional(),
    merchantReference: merchantReferenceSchema.optional(),
    metadata: paymentMetadataSchema,
  })
  .strict();

export const cursorSchema = z.string().trim().min(1).max(512).optional();

export const paginationSchema = z.object({
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidSchema = z.string().uuid();

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .transform((value) => value.toLowerCase())
  .pipe(z.string().email("A valid email address is required"));

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: passwordSchema,
    merchantName: z.string().trim().min(2).max(120),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const demoSessionRequestSchema = z
  .object({
    role: z.enum(DEMO_ROLES),
  })
  .strict();

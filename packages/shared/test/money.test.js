import { describe, expect, it } from "vitest";
import {
  MAX_MINOR_UNITS,
  formatMinorUnits,
  parseDecimalToMinor,
  toMinorUnits,
} from "../src/money.js";
import {
  amountMinorSchema,
  idempotencyKeySchema,
  paymentCreateSchema,
} from "../src/schemas.js";

describe("money helpers", () => {
  it("converts decimal strings to integer minor units without floats", () => {
    expect(parseDecimalToMinor("1299.00", "INR")).toBe("129900");
    expect(parseDecimalToMinor("0.01", "USD")).toBe("1");
    expect(parseDecimalToMinor("10", "USD")).toBe("1000");
    expect(parseDecimalToMinor("10.5", "USD")).toBe("1050");
    expect(parseDecimalToMinor("0.00", "INR")).toBe("0");
  });

  it("rejects malformed or over-precise decimal amounts", () => {
    expect(() => parseDecimalToMinor("1.234", "USD")).toThrow();
    expect(() => parseDecimalToMinor("-1.00", "USD")).toThrow();
    expect(() => parseDecimalToMinor("1e3", "USD")).toThrow();
    expect(() => parseDecimalToMinor(" 1.00", "USD")).toThrow();
    expect(() => parseDecimalToMinor("1,000.00", "USD")).toThrow();
    expect(() => parseDecimalToMinor("10.00", "EUR")).toThrow();
  });

  it("formats minor units using the currency exponent", () => {
    expect(formatMinorUnits("129900", "INR")).toBe("1299.00");
    expect(formatMinorUnits("1", "USD")).toBe("0.01");
    expect(formatMinorUnits("0", "USD")).toBe("0.00");
    expect(formatMinorUnits(MAX_MINOR_UNITS, "USD")).toBe("90071992547409.91");
  });

  it("only accepts string or BigInt minor units and enforces bounds", () => {
    expect(toMinorUnits("100")).toBe(100n);
    expect(toMinorUnits(100n)).toBe(100n);
    expect(() => toMinorUnits(100)).toThrow(/string or BigInt/);
    expect(() => toMinorUnits("01")).toThrow();
    expect(() => toMinorUnits("9007199254740992")).toThrow(/maximum/);
  });
});

describe("shared validation contracts", () => {
  it("accepts a valid payment payload", () => {
    const result = paymentCreateSchema.safeParse({
      amountMinor: "129900",
      currency: "INR",
      description: "Synthetic invoice INV-104",
      merchantReference: "INV-104",
    });

    expect(result.success).toBe(true);
  });

  it("rejects floats, zero, and unsupported currencies for payment amounts", () => {
    expect(amountMinorSchema.safeParse("12.99").success).toBe(false);
    expect(amountMinorSchema.safeParse("0").success).toBe(false);
    expect(amountMinorSchema.safeParse("00100").success).toBe(false);
    expect(amountMinorSchema.safeParse("9007199254740992").success).toBe(false);
    expect(amountMinorSchema.safeParse("100").success).toBe(true);

    const result = paymentCreateSchema.safeParse({
      amountMinor: "100",
      currency: "EUR",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes valid idempotency keys and rejects weak values", () => {
    const result = idempotencyKeySchema.safeParse("  demo-key-0001  ");
    expect(result.success).toBe(true);
    expect(result.data).toBe("demo-key-0001");
    expect(idempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("key with spaces").success).toBe(
      false,
    );
  });
});

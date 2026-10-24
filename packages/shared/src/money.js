import { CURRENCY_EXPONENT, SUPPORTED_CURRENCIES } from "./constants.js";

// Amounts are always positive integer minor units. This upper bound keeps every
// amount interoperable with JavaScript's safe-integer range even though BSON
// Long persistence and our arithmetic use integer representations. No amount is
// ever stored or calculated as a float.
export const MAX_MINOR_UNITS = 9_007_199_254_740_991n;

// Payment requests are synthetic and deliberately capped well below the
// transport-safe integer limit to prevent unrealistic or overflow-prone data.
export const MAX_PAYMENT_MINOR_UNITS = 1_000_000_000_000n;

const MINOR_UNITS_PATTERN = /^(0|[1-9]\d*)$/;

export function isSupportedCurrency(currency) {
  return (
    typeof currency === "string" && SUPPORTED_CURRENCIES.includes(currency)
  );
}

export function assertSupportedCurrency(currency) {
  if (!isSupportedCurrency(currency)) {
    throw new TypeError(`Unsupported currency: ${String(currency)}`);
  }
  return currency;
}

export function toMinorUnits(value) {
  let minor;

  if (typeof value === "bigint") {
    minor = value;
  } else if (typeof value === "string") {
    if (!MINOR_UNITS_PATTERN.test(value)) {
      throw new TypeError(
        "Minor units must be a positive base-10 digit string",
      );
    }
    minor = BigInt(value);
  } else {
    throw new TypeError("Minor units must be supplied as a string or BigInt");
  }

  if (minor < 0n) {
    throw new RangeError("Minor units cannot be negative");
  }

  if (minor > MAX_MINOR_UNITS) {
    throw new RangeError("Minor units exceed the supported maximum");
  }

  return minor;
}

export function parseDecimalToMinor(value, currency) {
  assertSupportedCurrency(currency);

  if (typeof value !== "string") {
    throw new TypeError("Decimal money values must be strings");
  }

  const exponent = CURRENCY_EXPONENT[currency];
  const match = new RegExp(`^(0|[1-9]\\d*)(?:\\.(\\d{1,${exponent}}))?$`).exec(
    value,
  );

  if (!match) {
    throw new TypeError(`Invalid ${currency} decimal amount`);
  }

  const [, wholePart, fractionPart = ""] = match;
  const factor = 10n ** BigInt(exponent);
  const fraction = BigInt(fractionPart.padEnd(exponent, "0"));
  const minor = BigInt(wholePart) * factor + fraction;

  if (minor > MAX_MINOR_UNITS) {
    throw new RangeError("Minor units exceed the supported maximum");
  }

  return minor.toString();
}

export function formatMinorUnits(value, currency) {
  assertSupportedCurrency(currency);

  const minor = toMinorUnits(value);
  const exponent = CURRENCY_EXPONENT[currency];
  const divisor = 10n ** BigInt(exponent);
  const wholePart = minor / divisor;

  if (exponent === 0) {
    return wholePart.toString();
  }

  const fractionPart = (minor % divisor).toString().padStart(exponent, "0");
  return `${wholePart}.${fractionPart}`;
}

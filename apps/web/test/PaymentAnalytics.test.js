import { describe, expect, it } from "vitest";
import {
  analyzePayments,
  paymentWindow,
} from "../src/features/analytics/paymentAnalytics.js";

const window = paymentWindow(7, new Date("2026-10-31T18:00:00Z"));
const payment = (overrides = {}) => ({
  currency: "USD",
  createdAt: "2026-10-30T12:00:00Z",
  amountMinor: "10000",
  capturedMinor: "0",
  refundedMinor: "0",
  status: "CREATED",
  ...overrides,
});

describe("payment analytics", () => {
  it("uses inclusive UTC calendar days across month boundaries", () => {
    expect(paymentWindow(7, new Date("2026-11-03T06:00:00Z"))).toEqual({
      from: "2026-10-28T00:00:00.000Z",
      to: "2026-11-03T06:00:00.000Z",
    });
    expect(analyzePayments([], "USD", window).trend).toHaveLength(7);
  });

  it("isolates currencies and dates, counts refunded captures, and preserves integer amounts", () => {
    const result = analyzePayments(
      [
        payment({
          status: "CAPTURED",
          capturedMinor: "9007199254740993",
          amountMinor: "9007199254740993",
        }),
        payment({
          status: "REFUNDED",
          capturedMinor: "10000",
          refundedMinor: "10000",
        }),
        payment({ status: "FAILED" }),
        payment({ status: "AUTHORIZED" }),
        payment({
          currency: "INR",
          status: "CAPTURED",
          capturedMinor: "999999",
        }),
        payment({ createdAt: "2026-09-01T00:00:00Z" }),
        payment({ createdAt: "2026-11-01T00:00:00Z" }),
      ],
      "USD",
      window,
    );
    expect(result.total).toBe(4);
    expect(result.captured).toBe("9007199254750993");
    expect(result.refunded).toBe("10000");
    expect(result.net).toBe("9007199254740993");
    expect(result.captureRate).toBe("50.0%");
    expect(result.failed).toBe(1);
    expect(result.outcomes.map((item) => item.count)).toEqual([2, 1, 1, 0, 0]);
    expect(
      result.trend.find((item) => item.date === "2026-10-30"),
    ).toMatchObject({ total: 4, captured: 2 });
  });

  it("shows an unavailable rate for an empty sample and keeps unknown states visible", () => {
    expect(analyzePayments([], "USD", window).captureRate).toBe("—");
    const result = analyzePayments(
      [payment({ status: "UNKNOWN" }), payment({ status: "CANCELLED" })],
      "USD",
      window,
    );
    expect(result.outcomes.find((item) => item.name === "Unknown").count).toBe(
      1,
    );
    expect(
      result.outcomes.find((item) => item.name === "Cancelled").count,
    ).toBe(1);
    expect(result.capturedCount).toBe(0);
  });
});

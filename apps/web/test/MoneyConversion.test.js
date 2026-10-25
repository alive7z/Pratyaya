import { describe, expect, it } from "vitest";
import { formatMoney, majorToMinorUnits } from "../src/lib/format.js";

describe("money boundary conversion", () => {
  it.each([
    ["500", "50000"],
    ["500.00", "50000"],
    ["5", "500"],
    ["5.25", "525"],
    ["0.01", "1"],
  ])("converts %s major units to %s minor units", (major, minor) => {
    expect(majorToMinorUnits(major)).toBe(minor);
  });

  it.each(["", "0", "1.234", "-1", "1e3", "01", "10000000001"])(
    "rejects invalid major-unit input %s",
    (value) => {
      expect(majorToMinorUnits(value)).toBeNull();
    },
  );

  it("formats backend minor units without converting twice", () => {
    expect(formatMoney("50000", "USD")).toBe("$500.00");
  });
});

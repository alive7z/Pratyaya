import { describe, expect, it } from "vitest";
import { isUnknownCommitResult } from "../src/lib/transaction.js";
import {
  normalizeJournalEntries,
  validateBalancedJournal,
} from "../src/modules/ledger/ledger-invariants.js";

const accountId = "64b00000000000000000901";

describe("financial invariants", () => {
  it("accepts balanced two-entry and multi-entry journals", () => {
    expect(
      validateBalancedJournal({
        currency: "INR",
        entries: [
          { accountId, direction: "DEBIT", amountMinor: "100000" },
          { accountId, direction: "CREDIT", amountMinor: "100000" },
        ],
      }).debitTotal,
    ).toBe(100000n);

    expect(
      validateBalancedJournal({
        currency: "USD",
        entries: [
          { accountId, direction: "DEBIT", amountMinor: "70" },
          { accountId, direction: "DEBIT", amountMinor: "30" },
          { accountId, direction: "CREDIT", amountMinor: "100" },
        ],
      }).creditTotal,
    ).toBe(100n);
  });

  it.each(["0", "-1", "1.2", 10, "9007199254740992"])(
    "rejects invalid minor-unit amount %s",
    (amountMinor) => {
      expect(() =>
        normalizeJournalEntries([
          { accountId, direction: "DEBIT", amountMinor },
          { accountId, direction: "CREDIT", amountMinor: "1" },
        ]),
      ).toThrow(/amount/i);
    },
  );

  it("rejects unbalanced journals", () => {
    expect(() =>
      validateBalancedJournal({
        currency: "INR",
        entries: [
          { accountId, direction: "DEBIT", amountMinor: "100" },
          { accountId, direction: "CREDIT", amountMinor: "99" },
        ],
      }),
    ).toThrow(/debits must equal credits/i);
  });

  it("identifies unknown transaction commit results", () => {
    const error = {
      hasErrorLabel: (label) => label === "UnknownTransactionCommitResult",
    };
    expect(isUnknownCommitResult(error)).toBe(true);
    expect(isUnknownCommitResult(new Error("ordinary"))).toBe(false);
  });
});

import {
  LEDGER_SIDES,
  MAX_MINOR_UNITS,
  assertSupportedCurrency,
  toMinorUnits,
} from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";

function invariant(code, message, details) {
  throw new AppError(422, code, message, details);
}

export function normalizeJournalEntries(entries) {
  if (!Array.isArray(entries) || entries.length < 2) {
    invariant(
      "JOURNAL_MINIMUM_ENTRIES",
      "A journal requires at least two entries",
    );
  }

  return entries.map((entry, index) => {
    if (!Object.values(LEDGER_SIDES).includes(entry.direction)) {
      invariant(
        "INVALID_LEDGER_DIRECTION",
        "Entry direction must be DEBIT or CREDIT",
        { index },
      );
    }

    let amount;
    try {
      amount = toMinorUnits(entry.amountMinor);
    } catch {
      invariant(
        "INVALID_LEDGER_AMOUNT",
        "Entry amount must be a positive integer minor-unit value",
        { index },
      );
    }
    if (amount <= 0n || amount > MAX_MINOR_UNITS) {
      invariant(
        "INVALID_LEDGER_AMOUNT",
        "Entry amount must be a positive safe integer in minor units",
        { index },
      );
    }

    return {
      accountId: entry.accountId,
      direction: entry.direction,
      amountMinor: amount,
      description: entry.description,
    };
  });
}

export function validateBalancedJournal({ currency, entries }) {
  try {
    assertSupportedCurrency(currency);
  } catch {
    invariant(
      "UNSUPPORTED_LEDGER_CURRENCY",
      "Journal currency is not supported",
    );
  }

  const normalized = normalizeJournalEntries(entries);
  let debits = 0n;
  let credits = 0n;
  for (const entry of normalized) {
    if (entry.direction === LEDGER_SIDES.DEBIT) debits += entry.amountMinor;
    else credits += entry.amountMinor;
  }

  if (debits !== credits) {
    invariant("UNBALANCED_JOURNAL", "Journal debits must equal credits", {
      debitMinor: debits.toString(),
      creditMinor: credits.toString(),
    });
  }

  return { entries: normalized, debitTotal: debits, creditTotal: credits };
}

export function assertAccountsMatchJournal({
  accounts,
  entries,
  merchantId,
  currency,
}) {
  const byId = new Map(
    accounts.map((account) => [String(account._id), account]),
  );
  for (const entry of entries) {
    const account = byId.get(String(entry.accountId));
    if (!account) {
      invariant(
        "LEDGER_ACCOUNT_NOT_FOUND",
        "Every journal entry must reference an active ledger account",
        {
          accountId: String(entry.accountId),
        },
      );
    }
    if (String(account.merchantId) !== String(merchantId)) {
      invariant(
        "CROSS_MERCHANT_LEDGER_ENTRY",
        "A journal cannot reference another merchant's account",
      );
    }
    if (account.currency !== currency) {
      invariant(
        "LEDGER_CURRENCY_MISMATCH",
        "Journal and account currencies must match",
        {
          accountId: String(account._id),
        },
      );
    }
    if (account.status !== "ACTIVE") {
      invariant(
        "LEDGER_ACCOUNT_INACTIVE",
        "Inactive accounts cannot receive new entries",
        {
          accountId: String(account._id),
        },
      );
    }
  }
}

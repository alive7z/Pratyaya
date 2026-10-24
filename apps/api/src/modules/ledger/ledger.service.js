import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import {
  LEDGER_ACCOUNT_CODES,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_EVENT_TYPES,
  LEDGER_NORMAL_BALANCES,
  LEDGER_SIDES,
  OUTBOX_EVENT_TYPES,
  OUTBOX_STATE,
} from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { OutboxEvent } from "../payments/outbox-event.model.js";
import { LedgerAccount } from "./ledger-account.model.js";
import { LedgerEvent } from "./ledger-event.model.js";
import { Journal } from "./journal.model.js";
import {
  assertAccountsMatchJournal,
  validateBalancedJournal,
} from "./ledger-invariants.js";

const ACCOUNT_DEFINITIONS = Object.freeze([
  {
    accountCode: LEDGER_ACCOUNT_CODES.PROVIDER_CLEARING,
    accountName: "Provider Clearing",
    accountType: LEDGER_ACCOUNT_TYPES.ASSET,
    normalBalance: LEDGER_NORMAL_BALANCES.DEBIT,
  },
  {
    accountCode: LEDGER_ACCOUNT_CODES.MERCHANT_PAYABLE,
    accountName: "Merchant Payable",
    accountType: LEDGER_ACCOUNT_TYPES.LIABILITY,
    normalBalance: LEDGER_NORMAL_BALANCES.CREDIT,
  },
]);

function deterministicReference({
  merchantId,
  sourceType,
  sourceId,
  eventType,
}) {
  const digest = createHash("sha256")
    .update(`${merchantId}|${sourceType}|${sourceId}|${eventType}`)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
  return `JRN-${digest}`;
}

function amountString(value) {
  return value?.toString?.() ?? String(value);
}

export function toJournalDto(journal) {
  return Object.freeze({
    id: String(journal._id),
    merchantId: String(journal.merchantId),
    journalReference: journal.journalReference,
    sourceType: journal.sourceType,
    sourceId: journal.sourceId,
    paymentId: journal.paymentId ? String(journal.paymentId) : null,
    eventType: journal.eventType,
    currency: journal.currency,
    status: journal.status,
    entries: Object.freeze(
      journal.entries.map((entry) =>
        Object.freeze({
          accountId: String(entry.accountId),
          direction: entry.direction,
          amountMinor: amountString(entry.amountMinor),
          description: entry.description ?? null,
        }),
      ),
    ),
    description: journal.description ?? null,
    postedAt: journal.postedAt,
    createdAt: journal.createdAt,
    createdBy: journal.createdBy,
    metadata: journal.metadata ?? null,
    reversalOfJournalId: journal.reversalOfJournalId
      ? String(journal.reversalOfJournalId)
      : null,
    isDemo: Boolean(journal.isDemo),
  });
}

function sameJournal(existing, requested) {
  if (
    existing.currency !== requested.currency ||
    existing.entries.length !== requested.entries.length
  )
    return false;
  return existing.entries.every((entry, index) => {
    const other = requested.entries[index];
    return (
      String(entry.accountId) === String(other.accountId) &&
      entry.direction === other.direction &&
      amountString(entry.amountMinor) === amountString(other.amountMinor)
    );
  });
}

export async function ensureChartOfAccounts({
  merchantId,
  currency,
  session,
  isDemo = false,
}) {
  const accounts = [];
  for (const definition of ACCOUNT_DEFINITIONS) {
    const account = await LedgerAccount.findOneAndUpdate(
      {
        merchantId,
        accountCode: definition.accountCode,
        currency,
      },
      {
        $setOnInsert: {
          merchantId,
          currency,
          status: "ACTIVE",
          isDemo,
          ...definition,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        session,
        setDefaultsOnInsert: true,
      },
    );

    if (
      !account ||
      account.accountType !== definition.accountType ||
      account.normalBalance !== definition.normalBalance
    ) {
      throw new AppError(
        409,
        "LEDGER_ACCOUNT_DEFINITION_CONFLICT",
        `Account ${definition.accountCode} conflicts with the chart of accounts`,
      );
    }
    accounts.push(account);
  }
  return Object.fromEntries(
    accounts.map((account) => [account.accountCode, account]),
  );
}

export async function postJournal(input) {
  const {
    merchantId,
    sourceType,
    sourceId,
    paymentId,
    eventType,
    currency,
    entries,
    session,
    description,
    createdBy,
    requestId,
    metadata,
    reversalOfJournalId,
    isDemo = false,
    injectFailure,
  } = input;

  if (!session?.inTransaction?.()) {
    throw new AppError(
      500,
      "LEDGER_TRANSACTION_REQUIRED",
      "Journal posting requires an active MongoDB transaction",
    );
  }
  if (!merchantId || !sourceType || !sourceId || !eventType || !createdBy) {
    throw new AppError(
      422,
      "INVALID_JOURNAL_REQUEST",
      "Journal source, merchant, event, and actor are required",
    );
  }

  const balanced = validateBalancedJournal({ currency, entries });
  const existing = await Journal.findOne({
    merchantId,
    sourceType,
    sourceId,
    eventType,
  }).session(session);
  if (existing) {
    if (!sameJournal(existing, { currency, entries: balanced.entries })) {
      throw new AppError(
        409,
        "JOURNAL_SOURCE_CONFLICT",
        "The source event was already posted with different accounting entries",
      );
    }
    return { journal: toJournalDto(existing), idempotent: true };
  }

  const accountIds = [
    ...new Set(balanced.entries.map((entry) => String(entry.accountId))),
  ];
  if (accountIds.some((id) => !mongoose.isValidObjectId(id))) {
    throw new AppError(
      422,
      "LEDGER_ACCOUNT_NOT_FOUND",
      "A journal account reference is invalid",
    );
  }
  const accounts = await LedgerAccount.find({
    _id: { $in: accountIds },
    merchantId,
    currency,
  }).session(session);
  assertAccountsMatchJournal({
    accounts,
    entries: balanced.entries,
    merchantId,
    currency,
  });

  if (reversalOfJournalId) {
    const original = await Journal.findOne({
      _id: reversalOfJournalId,
      merchantId,
      status: "POSTED",
    }).session(session);
    if (!original || original.currency !== currency) {
      throw new AppError(
        422,
        "INVALID_REVERSAL",
        "Reversal must reference a posted journal for the same merchant and currency",
      );
    }
  }

  const journalReference = deterministicReference({
    merchantId,
    sourceType,
    sourceId,
    eventType,
  });
  const [journal] = await Journal.create(
    [
      {
        merchantId,
        journalReference,
        sourceType,
        sourceId,
        paymentId,
        eventType,
        currency,
        status: "POSTED",
        entries: balanced.entries,
        description,
        postedAt: new Date(),
        createdBy,
        metadata,
        reversalOfJournalId,
        isDemo,
      },
    ],
    { session },
  );

  await LedgerEvent.create(
    [
      {
        eventId: randomUUID(),
        merchantId,
        journalId: journal._id,
        journalReference,
        eventType,
        actor: createdBy,
        requestId,
        metadata: { sourceType, sourceId },
        isDemo,
      },
    ],
    { session },
  );

  await OutboxEvent.create(
    [
      {
        merchantId,
        aggregateType: "journal",
        aggregateId: journal._id,
        eventType: OUTBOX_EVENT_TYPES.LEDGER_JOURNAL_POSTED,
        payload: {
          journalId: String(journal._id),
          journalReference,
          eventType,
          currency,
        },
        state: OUTBOX_STATE.PENDING,
        availableAt: new Date(),
        isDemo,
      },
    ],
    { session },
  );

  if (injectFailure) throw new Error("Injected ledger transaction failure");
  return { journal: toJournalDto(journal), idempotent: false };
}

export function captureEntries(accounts, amountMinor) {
  return [
    {
      accountId: accounts[LEDGER_ACCOUNT_CODES.PROVIDER_CLEARING]._id,
      direction: LEDGER_SIDES.DEBIT,
      amountMinor,
      description: "Receivable from simulated provider",
    },
    {
      accountId: accounts[LEDGER_ACCOUNT_CODES.MERCHANT_PAYABLE]._id,
      direction: LEDGER_SIDES.CREDIT,
      amountMinor,
      description: "Amount owed to merchant",
    },
  ];
}

export function refundEntries(accounts, amountMinor) {
  return [
    {
      accountId: accounts[LEDGER_ACCOUNT_CODES.MERCHANT_PAYABLE]._id,
      direction: LEDGER_SIDES.DEBIT,
      amountMinor,
      description: "Reduce amount owed to merchant",
    },
    {
      accountId: accounts[LEDGER_ACCOUNT_CODES.PROVIDER_CLEARING]._id,
      direction: LEDGER_SIDES.CREDIT,
      amountMinor,
      description: "Reverse simulated provider receivable",
    },
  ];
}

export const supportedLedgerEvents = LEDGER_EVENT_TYPES;

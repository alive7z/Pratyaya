import mongoose from "mongoose";
import { LEDGER_NORMAL_BALANCES, LEDGER_SIDES } from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { Journal } from "./journal.model.js";
import { LedgerAccount } from "./ledger-account.model.js";
import { toJournalDto } from "./ledger.service.js";

function accountDto(account, totals = {}) {
  const debit = BigInt(totals.debitMinor ?? 0);
  const credit = BigInt(totals.creditMinor ?? 0);
  const net =
    account.normalBalance === LEDGER_NORMAL_BALANCES.DEBIT
      ? debit - credit
      : credit - debit;
  return {
    id: String(account._id),
    accountCode: account.accountCode,
    accountName: account.accountName,
    accountType: account.accountType,
    currency: account.currency,
    normalBalance: account.normalBalance,
    status: account.status,
    debitMinor: debit.toString(),
    creditMinor: credit.toString(),
    netMinor: net.toString(),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

async function totalsByAccount({ merchantId, currency, accountId }) {
  const match = {
    merchantId: new mongoose.Types.ObjectId(String(merchantId)),
    status: "POSTED",
  };
  if (currency) match.currency = currency;
  const pipeline = [
    { $match: match },
    { $unwind: "$entries" },
    ...(accountId
      ? [
          {
            $match: {
              "entries.accountId": new mongoose.Types.ObjectId(
                String(accountId),
              ),
            },
          },
        ]
      : []),
    {
      $group: {
        _id: "$entries.accountId",
        debitMinor: {
          $sum: {
            $cond: [
              { $eq: ["$entries.direction", LEDGER_SIDES.DEBIT] },
              "$entries.amountMinor",
              0,
            ],
          },
        },
        creditMinor: {
          $sum: {
            $cond: [
              { $eq: ["$entries.direction", LEDGER_SIDES.CREDIT] },
              "$entries.amountMinor",
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        debitMinor: { $toString: "$debitMinor" },
        creditMinor: { $toString: "$creditMinor" },
      },
    },
  ];
  const rows = await Journal.aggregate(pipeline);
  return new Map(rows.map((row) => [String(row._id), row]));
}

export async function listAccounts({ merchantId, query }) {
  const filter = { merchantId };
  if (query.currency) filter.currency = query.currency;
  if (query.status) filter.status = query.status;
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const [accounts, total] = await Promise.all([
    LedgerAccount.find(filter)
      .sort({ currency: 1, accountCode: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LedgerAccount.countDocuments(filter),
  ]);
  const totals = await totalsByAccount({
    merchantId,
    currency: query.currency,
  });
  return {
    items: accounts.map((account) =>
      accountDto(account, totals.get(String(account._id))),
    ),
    page,
    limit,
    total,
  };
}

export async function getAccount({ merchantId, accountId }) {
  const account = await LedgerAccount.findOne({
    _id: accountId,
    merchantId,
  }).lean();
  if (!account)
    throw new AppError(
      404,
      "LEDGER_ACCOUNT_NOT_FOUND",
      "Ledger account not found",
    );
  const totals = await totalsByAccount({ merchantId, accountId });
  return accountDto(account, totals.get(String(account._id)));
}

export async function getAccountEntries({ merchantId, accountId, query }) {
  const account = await LedgerAccount.findOne({
    _id: accountId,
    merchantId,
  }).lean();
  if (!account)
    throw new AppError(
      404,
      "LEDGER_ACCOUNT_NOT_FOUND",
      "Ledger account not found",
    );
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const match = {
    merchantId: new mongoose.Types.ObjectId(String(merchantId)),
    "entries.accountId": new mongoose.Types.ObjectId(accountId),
  };
  const items = await Journal.aggregate([
    { $match: match },
    { $sort: { postedAt: -1, _id: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $unwind: "$entries" },
    { $match: { "entries.accountId": new mongoose.Types.ObjectId(accountId) } },
    {
      $project: {
        journalId: { $toString: "$_id" },
        journalReference: 1,
        eventType: 1,
        sourceId: 1,
        direction: "$entries.direction",
        amountMinor: { $toString: "$entries.amountMinor" },
        description: "$entries.description",
        postedAt: 1,
      },
    },
  ]);
  const total = await Journal.countDocuments(match);
  return { account: accountDto(account), items, page, limit, total };
}

export async function listJournals({ merchantId, query }) {
  const filter = { merchantId };
  if (query.currency) filter.currency = query.currency;
  if (query.eventType) filter.eventType = query.eventType;
  if (query.accountId) filter["entries.accountId"] = query.accountId;
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { journalReference: { $regex: escaped, $options: "i" } },
      { sourceId: { $regex: escaped, $options: "i" } },
    ];
  }
  if (query.from || query.to) {
    filter.postedAt = {};
    if (query.from) filter.postedAt.$gte = new Date(query.from);
    if (query.to) filter.postedAt.$lte = new Date(query.to);
  }
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const [journals, total] = await Promise.all([
    Journal.find(filter)
      .sort({ postedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Journal.countDocuments(filter),
  ]);
  return { items: journals.map(toJournalDto), page, limit, total };
}

export async function getJournal({ merchantId, journalId }) {
  const journal = await Journal.findOne({ _id: journalId, merchantId }).lean();
  if (!journal)
    throw new AppError(404, "JOURNAL_NOT_FOUND", "Journal not found");
  return toJournalDto(journal);
}

export async function getBalances({ merchantId, currency }) {
  const { items } = await listAccounts({
    merchantId,
    query: { currency, limit: 100, page: 1 },
  });
  const grouped = Object.groupBy(items, (account) => account.currency);
  return Object.entries(grouped).map(([groupCurrency, accounts]) => ({
    currency: groupCurrency,
    accounts,
    categories: Object.entries(
      Object.groupBy(accounts, (account) => account.accountType),
    ).map(([accountType, categoryAccounts]) => ({
      accountType,
      accounts: categoryAccounts,
    })),
  }));
}

export async function getTrialBalance({ merchantId, currency }) {
  const balances = await getBalances({ merchantId, currency });
  return balances.map((group) => {
    const debitMinor = group.accounts.reduce(
      (sum, account) => sum + BigInt(account.debitMinor),
      0n,
    );
    const creditMinor = group.accounts.reduce(
      (sum, account) => sum + BigInt(account.creditMinor),
      0n,
    );
    return {
      ...group,
      totalDebitMinor: debitMinor.toString(),
      totalCreditMinor: creditMinor.toString(),
      balanced: debitMinor === creditMinor,
    };
  });
}

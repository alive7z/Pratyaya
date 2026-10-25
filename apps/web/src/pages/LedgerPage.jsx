import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  Scale,
  WalletCards,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { ledgerApi } from "../lib/apiClient.js";
import { formatMinorUnits } from "../lib/format.js";
import { useAuth } from "../app/AuthContext.jsx";
import { cn } from "../lib/utils.js";

const TABS = [
  "Overview",
  "Accounts",
  "Journals",
  "Integrity",
  "Reconciliation",
];

const PAGE_SIZE = 20;

const cardClass =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950";

const inputClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function rowsOf(query) {
  return query.data?.data?.items ?? [];
}

function totalOf(query) {
  return query.data?.data?.total ?? rowsOf(query).length;
}

function minor(value) {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function money(value, currency = "USD") {
  if (value == null) return "—";

  try {
    return formatMinorUnits(String(value), currency);
  } catch {
    return "—";
  }
}

function displayDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading ledger"
      className="grid gap-4 sm:grid-cols-3"
    >
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}

function Failure({ error, onRetry }) {
  const unauthorized = error?.status === 401;

  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0" />

        <div>
          <p className="font-semibold">Ledger data is unavailable</p>
          <p className="mt-1 text-sm">
            {unauthorized
              ? "Sign in or start a demo session to access ledger records."
              : error?.message || "Unable to load ledger data."}
          </p>

          {unauthorized ? (
            <Link
              to="/login"
              className="mt-3 inline-block text-sm font-semibold underline"
            >
              Sign in
            </Link>
          ) : (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
      {text}
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <Icon
          className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
      </div>

      <p className="mt-3 wrap-break-word text-xl font-bold tracking-tight text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function Pagination({ page, total, limit = PAGE_SIZE, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));

  if (pages <= 1) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Page {page} of {pages} · {total} records
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="btn-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="btn-secondary"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function LedgerPage() {
  const { auth, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState("Overview");
  const [currency, setCurrency] = useState("USD");
  const [accountPage, setAccountPage] = useState(1);
  const [journalPage, setJournalPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [journalSearch, setJournalSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedJournal, setSelectedJournal] = useState(null);

  const merchantId = auth?.merchantId ?? null;
  const role = auth?.membership?.role;
  const isAuthenticated = Boolean(auth);

  const canRun =
    role === "ADMIN" ||
    role === "AUDITOR" ||
    hasPermission("ledger.integrity.run");

  const accounts = useQuery({
    queryKey: ["ledger", "accounts", merchantId, currency, accountPage],
    queryFn: () =>
      ledgerApi.accounts({
        currency,
        page: accountPage,
        limit: PAGE_SIZE,
      }),
    enabled: isAuthenticated && (tab === "Accounts" || tab === "Overview"),
    staleTime: 15000,
  });

  const allAccounts = useQuery({
    queryKey: ["ledger", "accounts", merchantId, currency, "summary"],
    queryFn: () =>
      ledgerApi.accounts({
        currency,
        page: 1,
        limit: 100,
      }),
    enabled: isAuthenticated && tab === "Overview",
    staleTime: 15000,
  });

  const journals = useQuery({
    queryKey: [
      "ledger",
      "journals",
      merchantId,
      currency,
      journalPage,
      journalSearch,
    ],
    queryFn: () =>
      ledgerApi.journals({
        currency,
        page: journalPage,
        limit: PAGE_SIZE,
        search: journalSearch,
      }),
    enabled: isAuthenticated && (tab === "Overview" || tab === "Journals"),
    staleTime: 15000,
  });

  const accountDetail = useQuery({
    queryKey: ["ledger", "account", merchantId, selectedAccountId],
    queryFn: () => ledgerApi.account(selectedAccountId),
    enabled: isAuthenticated && Boolean(selectedAccountId),
  });

  const accountEntries = useQuery({
    queryKey: ["ledger", "account", merchantId, selectedAccountId, "entries"],
    queryFn: () =>
      ledgerApi.accountEntries(selectedAccountId, {
        limit: PAGE_SIZE,
      }),
    enabled: isAuthenticated && Boolean(selectedAccountId),
  });

  const reports = useQuery({
    queryKey: ["ledger", "integrity", merchantId, currency],
    queryFn: () => ledgerApi.integrityReports({ currency }),
    enabled: isAuthenticated && (tab === "Overview" || tab === "Integrity"),
  });

  const reconciliation = useQuery({
    queryKey: ["ledger", "reconciliation", merchantId],
    queryFn: () => ledgerApi.reconciliation({ limit: 50 }),
    enabled: isAuthenticated && tab === "Reconciliation",
  });

  const runCheck = useMutation({
    mutationFn: () => ledgerApi.runIntegrity(currency),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["ledger", "integrity", merchantId],
      }),
  });

  const accountRows = rowsOf(accounts);
  const journalRows = rowsOf(journals);
  const reportRows = rowsOf(reports);

  const overviewAccounts = rowsOf(allAccounts);
  const accountTotal = totalOf(allAccounts);
  const hasCompleteSummary =
    !allAccounts.isPending &&
    !allAccounts.isError &&
    overviewAccounts.length >= accountTotal;

  const accountMap = useMemo(
    () =>
      new Map(
        [...overviewAccounts, ...accountRows].map((account) => [
          account.id,
          account,
        ]),
      ),
    [overviewAccounts, accountRows],
  );

  const { totalDebits, totalCredits } = useMemo(
    () =>
      overviewAccounts.reduce(
        (result, account) => ({
          totalDebits: result.totalDebits + minor(account.debitMinor),
          totalCredits: result.totalCredits + minor(account.creditMinor),
        }),
        { totalDebits: 0n, totalCredits: 0n },
      ),
    [overviewAccounts],
  );

  const latestReport = reportRows.find(
    (report) => !report.currency || report.currency === currency,
  );

  const changeCurrency = (value) => {
    setCurrency(value);
    setAccountPage(1);
    setJournalPage(1);
    setSelectedAccountId(null);
    setSelectedJournal(null);
    setJournalSearch("");
    setSearchInput("");
  };

  const changeTab = (value) => {
    setTab(value);
    setSelectedJournal(null);
    setSelectedAccountId(null);
  };

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["ledger"],
    });
  };

  const activeError =
    tab === "Overview"
      ? accounts.error || journals.error
      : tab === "Accounts"
        ? accounts.error
        : tab === "Journals"
          ? journals.error
          : null;

  const activeLoading =
    (tab === "Overview" && (accounts.isPending || journals.isPending)) ||
    (tab === "Accounts" && accounts.isPending) ||
    (tab === "Journals" && journals.isPending);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Financial truth</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Ledger Explorer
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Explore immutable journals, account balances, integrity checks, and
            reconciliation records.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Currency
            <select
              value={currency}
              onChange={(event) => changeCurrency(event.target.value)}
              className={inputClass}
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </select>
          </label>

          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh ledger"
            className="btn-secondary h-10"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Ledger sections"
        className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900"
      >
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => changeTab(item)}
            className={cn(
              "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === item
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {!isAuthenticated ? (
        <Failure error={{ status: 401 }} />
      ) : activeLoading ? (
        <Loading />
      ) : activeError ? (
        <Failure error={activeError} onRetry={refresh} />
      ) : (
        <>
          {tab === "Overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="Posted journals"
                  value={String(totalOf(journals))}
                  icon={BookOpen}
                />
                <Metric
                  label="Debit movements"
                  value={
                    hasCompleteSummary ? money(totalDebits, currency) : "—"
                  }
                  icon={WalletCards}
                />
                <Metric
                  label="Credit movements"
                  value={
                    hasCompleteSummary ? money(totalCredits, currency) : "—"
                  }
                  icon={Scale}
                />
                <Metric
                  label="Latest integrity scan"
                  value={
                    reports.isPending
                      ? "Loading..."
                      : (latestReport?.status ?? "Not run")
                  }
                  icon={
                    latestReport?.status === "PASS"
                      ? CheckCircle2
                      : AlertTriangle
                  }
                />
              </div>

              {!hasCompleteSummary && !allAccounts.isPending && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Debit and credit totals are unavailable until the complete
                  account summary can be retrieved.
                </p>
              )}

              <section className={cardClass}>
                <h2 className="font-semibold">Recent financial activity</h2>

                {journalRows.length ? (
                  <JournalTable
                    rows={journalRows.slice(0, 8)}
                    onSelect={setSelectedJournal}
                  />
                ) : (
                  <Empty text="No posted financial activity exists for this currency." />
                )}

                {selectedJournal && (
                  <JournalDetail
                    journal={selectedJournal}
                    accounts={accountMap}
                    onClose={() => setSelectedJournal(null)}
                  />
                )}
              </section>
            </>
          )}

          {tab === "Accounts" && (
            <section className={cardClass}>
              <h2 className="font-semibold">Chart of accounts</h2>

              {accountRows.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                      <tr>
                        {[
                          "Account",
                          "Type",
                          "Debit",
                          "Credit",
                          "Net balance",
                          "Status",
                        ].map((heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="whitespace-nowrap px-3 py-3 font-semibold"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {accountRows.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-b border-slate-100 transition-colors dark:border-slate-800",
                            "hover:bg-slate-50 dark:hover:bg-slate-900",
                            selectedAccountId === row.id &&
                              "bg-blue-50 dark:bg-blue-950/20",
                          )}
                        >
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedAccountId(row.id)}
                              className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              <span className="block font-semibold text-blue-700 dark:text-blue-400">
                                {row.accountName}
                              </span>
                              <span className="block font-mono text-xs text-slate-500">
                                {row.accountCode}
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-3">{row.accountType}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {money(row.debitMinor, row.currency)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {money(row.creditMinor, row.currency)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold">
                            {money(row.netMinor, row.currency)}
                          </td>
                          <td className="px-3 py-3">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty text="No ledger accounts exist for this currency." />
              )}

              <Pagination
                page={accountPage}
                total={totalOf(accounts)}
                onPage={setAccountPage}
              />

              {selectedAccountId && (
                <AccountDetail
                  account={accountDetail.data?.data}
                  entries={rowsOf(accountEntries)}
                  pending={accountDetail.isPending || accountEntries.isPending}
                  error={accountDetail.error || accountEntries.error}
                  onClose={() => setSelectedAccountId(null)}
                />
              )}
            </section>
          )}

          {tab === "Journals" && (
            <section className={cardClass}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Immutable journals</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Search by journal reference or source event.
                  </p>
                </div>

                <form
                  className="flex max-w-full items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setJournalPage(1);
                    setJournalSearch(searchInput.trim());
                  }}
                >
                  <input
                    aria-label="Search journals"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Reference or source ID"
                    className={cn(inputClass, "min-w-0 w-48 sm:w-64")}
                  />
                  <button type="submit" className="btn-secondary">
                    <Search className="h-4 w-4" />
                    Search
                  </button>
                </form>
              </div>

              {journalRows.length ? (
                <JournalTable
                  rows={journalRows}
                  onSelect={setSelectedJournal}
                />
              ) : (
                <Empty text="No journals match the selected filters." />
              )}

              <Pagination
                page={journalPage}
                total={totalOf(journals)}
                onPage={setJournalPage}
              />

              {selectedJournal && (
                <JournalDetail
                  journal={selectedJournal}
                  accounts={accountMap}
                  onClose={() => setSelectedJournal(null)}
                />
              )}
            </section>
          )}

          {tab === "Integrity" && (
            <IntegrityPanel
              reports={reportRows}
              pending={reports.isPending}
              error={reports.error}
              canRun={canRun}
              runCheck={runCheck}
              currency={currency}
              onRetry={() => reports.refetch()}
            />
          )}

          {tab === "Reconciliation" && (
            <ReconciliationPanel query={reconciliation} />
          )}
        </>
      )}
    </div>
  );
}

function JournalTable({ rows, onSelect }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
          <tr>
            {[
              "Reference",
              "Event",
              "Source",
              "Debit",
              "Credit",
              "Currency",
              "Posted",
            ].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="whitespace-nowrap px-3 py-3 font-semibold"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((journal) => {
            const entries = journal.entries ?? [];

            const debit = entries.reduce(
              (sum, entry) =>
                entry.direction === "DEBIT"
                  ? sum + minor(entry.amountMinor)
                  : sum,
              0n,
            );

            const credit = entries.reduce(
              (sum, entry) =>
                entry.direction === "CREDIT"
                  ? sum + minor(entry.amountMinor)
                  : sum,
              0n,
            );

            return (
              <tr
                key={journal.id}
                className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(journal)}
                    className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    {journal.journalReference}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {journal.eventType}
                </td>
                <td className="max-w-44 truncate px-3 py-3 font-mono text-xs text-slate-500">
                  {journal.paymentId ?? journal.sourceId ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {entries.length ? money(debit, journal.currency) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {entries.length ? money(credit, journal.currency) : "—"}
                </td>
                <td className="px-3 py-3">{journal.currency}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                  {displayDate(journal.postedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function JournalDetail({ journal, accounts, onClose }) {
  return (
    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs text-blue-700 dark:text-blue-400">
            {journal.journalReference}
          </p>
          <h3 className="mt-1 font-semibold">Debit / credit breakdown</h3>
          <p className="mt-1 break-all text-xs text-slate-500">
            Source: {journal.sourceType ?? "—"} ·{" "}
            {journal.paymentId ?? journal.sourceId ?? "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close journal details"
          className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {(journal.entries ?? []).map((entry, index) => {
          const account = accounts.get(entry.accountId);

          return (
            <div
              key={`${entry.accountId}-${index}`}
              className="grid gap-2 rounded-lg bg-white p-3 text-sm dark:bg-slate-900 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {account?.accountName ?? "Account"}
                </p>
                <p className="break-all font-mono text-xs text-slate-500">
                  {account?.accountCode ?? entry.accountId}
                </p>
              </div>
              <span className="text-xs font-medium">{entry.direction}</span>
              <strong>{money(entry.amountMinor, journal.currency)}</strong>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Posted journals are immutable. Corrections require linked compensating
        journals.
      </p>
    </div>
  );
}

function AccountDetail({ account, entries, pending, error, onClose }) {
  return (
    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
            Account detail
          </p>
          <h3 className="mt-1 font-semibold">
            {account?.accountName ?? "Account"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close account details"
          className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {pending ? (
        <div className="mt-4">
          <Loading />
        </div>
      ) : error ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error.message}
        </p>
      ) : (
        <>
          {account && (
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
              {[
                ["Code", account.accountCode],
                ["Type", account.accountType],
                ["Debit", money(account.debitMinor, account.currency)],
                ["Net balance", money(account.netMinor, account.currency)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 break-all font-medium">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-5 space-y-2">
            {entries.length ? (
              entries.map((entry, index) => (
                <div
                  key={`${entry.journalId}-${index}`}
                  className="grid gap-2 rounded-lg bg-white p-3 text-xs dark:bg-slate-900 sm:grid-cols-4"
                >
                  <span className="break-all font-mono">
                    {entry.journalReference}
                  </span>
                  <span>{entry.eventType}</span>
                  <span>{entry.direction}</span>
                  <strong>{money(entry.amountMinor, account?.currency)}</strong>
                </div>
              ))
            ) : (
              <Empty text="No posted entries use this account." />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function IntegrityPanel({
  reports,
  pending,
  error,
  canRun,
  runCheck,
  currency,
  onRetry,
}) {
  const latest = reports.find(
    (report) => !report.currency || report.currency === currency,
  );

  return (
    <section className="space-y-4">
      <div
        className={cn(
          cardClass,
          "flex flex-wrap items-center justify-between gap-4",
        )}
      >
        <div>
          <p className="eyebrow">Pratyaya Ledger Integrity Guardian</p>
          <h2 className="mt-2 text-xl font-bold">
            {latest?.status ?? "No verification run"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Verification results cover only the checks and records examined.
          </p>
        </div>

        {canRun ? (
          <button
            type="button"
            disabled={runCheck.isPending}
            onClick={() => runCheck.mutate()}
            className="btn-primary"
          >
            <RefreshCw
              className={cn("h-4 w-4", runCheck.isPending && "animate-spin")}
            />
            {runCheck.isPending ? "Verifying..." : "Run verification"}
          </button>
        ) : (
          <p className="text-xs text-slate-500">
            Administrator or auditor access required.
          </p>
        )}
      </div>

      {runCheck.isError && (
        <Failure error={runCheck.error} onRetry={() => runCheck.mutate()} />
      )}

      {pending ? (
        <Loading />
      ) : error ? (
        <Failure error={error} onRetry={onRetry} />
      ) : latest ? (
        <div className={cardClass}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Passed"
              value={String(latest.summary?.passed ?? 0)}
              icon={CheckCircle2}
            />
            <Metric
              label="Failed"
              value={String(latest.summary?.failed ?? 0)}
              icon={AlertTriangle}
            />
            <Metric
              label="Inconclusive"
              value={String(latest.summary?.inconclusive ?? 0)}
              icon={RefreshCw}
            />
          </div>

          <div className="mt-5 space-y-3">
            {(latest.checks ?? []).map((check) => (
              <div
                key={check.checkId}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{check.checkName}</p>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      check.status === "PASS"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : check.status === "FAIL"
                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                    )}
                  >
                    {check.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {check.affectedRecords ?? 0} affected ·{" "}
                  {check.severity ?? "Unknown severity"} ·{" "}
                  {check.remediation ?? "No remediation provided"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Empty text={`No ${currency} integrity report exists yet.`} />
      )}
    </section>
  );
}

function ReconciliationPanel({ query }) {
  if (query.isPending) return <Loading />;

  if (query.error) {
    return <Failure error={query.error} onRetry={() => query.refetch()} />;
  }

  const rows = rowsOf(query);
  const summary = query.data?.data?.summary ?? {};

  return (
    <section className={cardClass}>
      <h2 className="font-semibold">Reconciliation workspace</h2>

      <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
        Provider comparison records use synthetic fixtures until simulator
        integration is enabled.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(summary).map(([status, count]) => (
          <span
            key={status}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold dark:border-slate-700"
          >
            {status}: {count}
          </span>
        ))}
      </div>

      {rows.length ? (
        <div className="mt-5 space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-4 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div>
                <p className="text-xs text-slate-500">Provider reference</p>
                <p className="mt-1 break-all font-mono text-xs">
                  {row.providerReference ?? "Missing"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Internal / external</p>
                <p className="mt-1">
                  {row.internalPaymentStatus ?? "—"} /{" "}
                  {row.externalProviderStatus ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Expected / observed</p>
                <p className="mt-1">
                  {money(row.expectedAmountMinor, row.currency)} /{" "}
                  {money(row.observedAmountMinor, row.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="mt-1 font-semibold">{row.status}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="No reconciliation records are available." />
      )}
    </section>
  );
}

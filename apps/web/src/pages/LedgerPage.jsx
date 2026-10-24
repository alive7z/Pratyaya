import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  Scale,
  WalletCards,
} from "lucide-react";
import { authApi, ledgerApi } from "../lib/apiClient.js";
import { formatMinorUnits } from "../lib/format.js";

const tabs = [
  "Overview",
  "Accounts",
  "Journals",
  "Integrity",
  "Reconciliation",
];

function Loading() {
  return (
    <div aria-label="Loading ledger" className="grid gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}

function Failure({ error }) {
  return (
    <div role="alert" className="card border-red-200 bg-red-50 text-red-800">
      <p className="font-semibold">Ledger data is unavailable</p>
      <p className="mt-1 text-sm">
        {error?.status === 401
          ? "Start a demo session or sign in to access merchant-scoped records."
          : error?.message}
      </p>
      {error?.status === 401 ? (
        <a href="/login" className="subtle-link mt-3">
          Open secure access
        </a>
      ) : null}
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function LedgerPage() {
  const [tab, setTab] = useState("Overview");
  const [currency, setCurrency] = useState("USD");
  const [selectedJournal, setSelectedJournal] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [journalPage, setJournalPage] = useState(1);
  const [accountPage, setAccountPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [journalSearch, setJournalSearch] = useState("");
  const queryClient = useQueryClient();
  const auth = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
  });
  const accounts = useQuery({
    queryKey: ["ledger", "accounts", currency, accountPage],
    queryFn: () =>
      ledgerApi.accounts({ currency, page: accountPage, limit: 20 }),
  });
  const allAccounts = useQuery({
    queryKey: ["ledger", "accounts", currency, "all"],
    queryFn: () => ledgerApi.accounts({ currency, limit: 100 }),
  });
  const journals = useQuery({
    queryKey: ["ledger", "journals", currency, journalPage, journalSearch],
    queryFn: () =>
      ledgerApi.journals({
        currency,
        page: journalPage,
        limit: 20,
        search: journalSearch,
      }),
  });
  const accountDetail = useQuery({
    queryKey: ["ledger", "account", selectedAccountId],
    queryFn: () => ledgerApi.account(selectedAccountId),
    enabled: Boolean(selectedAccountId),
  });
  const accountEntries = useQuery({
    queryKey: ["ledger", "account", selectedAccountId, "entries"],
    queryFn: () => ledgerApi.accountEntries(selectedAccountId, { limit: 20 }),
    enabled: Boolean(selectedAccountId),
  });
  const reports = useQuery({
    queryKey: ["ledger", "integrity", currency],
    queryFn: () => ledgerApi.integrityReports({ currency }),
    enabled: tab === "Integrity" || tab === "Overview",
  });
  const reconciliation = useQuery({
    queryKey: ["ledger", "reconciliation"],
    queryFn: () => ledgerApi.reconciliation({ limit: 50 }),
    enabled: tab === "Reconciliation",
  });
  const runCheck = useMutation({
    mutationFn: () => ledgerApi.runIntegrity(currency),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["ledger", "integrity"] }),
  });

  const accountRows = accounts.data?.data?.items ?? [];
  const overviewAccounts = allAccounts.data?.data?.items ?? accountRows;
  const accountMap = new Map(
    overviewAccounts.map((account) => [account.id, account]),
  );
  const journalRows = journals.data?.data?.items ?? [];
  const journalTotal = journals.data?.data?.total ?? journalRows.length;
  const latestReport = (reports.data?.data?.items ?? []).find(
    (report) => report.currency === currency || !report.currency,
  );
  const role = auth.data?.data?.membership?.role;
  const canRun = role === "ADMIN" || role === "AUDITOR";
  const totalDebits = overviewAccounts.reduce(
    (sum, item) => sum + BigInt(item.debitMinor),
    0n,
  );
  const totalCredits = overviewAccounts.reduce(
    (sum, item) => sum + BigInt(item.creditMinor),
    0n,
  );
  const error = accounts.error || journals.error;

  function changeCurrency(nextCurrency) {
    setCurrency(nextCurrency);
    setJournalPage(1);
    setAccountPage(1);
    setSelectedJournal(null);
    setSelectedAccountId(null);
    setJournalSearch("");
    setSearchInput("");
  }

  function changeTab(nextTab) {
    setTab(nextTab);
    setSelectedJournal(null);
    if (nextTab !== "Accounts") setSelectedAccountId(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Financial truth</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Ledger Explorer
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Balances are derived from immutable posted journals. Authorization
            and pending volume are never presented as settled funds.
          </p>
        </div>
        <label className="text-sm font-medium">
          Currency
          <select
            value={currency}
            onChange={(event) => changeCurrency(event.target.value)}
            className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option>USD</option>
            <option>INR</option>
          </select>
        </label>
      </header>

      <div
        className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900"
        role="tablist"
      >
        {tabs.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            onClick={() => changeTab(item)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${tab === item ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {accounts.isPending || journals.isPending ? (
        <Loading />
      ) : error ? (
        <Failure error={error} />
      ) : null}

      {!accounts.isPending && !error && tab === "Overview" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Posted journals"
              value={journalTotal.toString()}
              icon={BookOpen}
            />
            <Metric
              label="Debit movements"
              value={formatMinorUnits(totalDebits.toString(), currency)}
              icon={WalletCards}
            />
            <Metric
              label="Credit movements"
              value={formatMinorUnits(totalCredits.toString(), currency)}
              icon={Scale}
            />
            <Metric
              label="Latest integrity scan"
              value={latestReport?.status ?? "Not run"}
              icon={
                latestReport?.status === "PASS" ? CheckCircle2 : AlertTriangle
              }
            />
          </div>
          <section className="card">
            <h2 className="font-semibold">Recent financial activity</h2>
            {journalRows.length ? (
              <JournalTable
                rows={journalRows.slice(0, 8)}
                onSelect={setSelectedJournal}
                accounts={accountMap}
              />
            ) : (
              <Empty text="No posted financial movement exists for this currency." />
            )}
          </section>
        </>
      ) : null}

      {!accounts.isPending && !error && tab === "Accounts" ? (
        <section className="card overflow-hidden">
          <h2 className="font-semibold">Chart of accounts</h2>
          {accountRows.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-3">Account</th>
                    <th>Type</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Net balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accountRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedAccountId(row.id)}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-950/20 ${selectedAccountId === row.id ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                    >
                      <td className="py-3 pr-5">
                        <p className="font-semibold">{row.accountName}</p>
                        <p className="font-mono text-xs text-slate-500">
                          {row.accountCode}
                        </p>
                      </td>
                      <td>{row.accountType}</td>
                      <td>{formatMinorUnits(row.debitMinor, row.currency)}</td>
                      <td>{formatMinorUnits(row.creditMinor, row.currency)}</td>
                      <td className="font-semibold">
                        {formatMinorUnits(row.netMinor, row.currency)}
                      </td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="No ledger accounts have been created for this currency." />
          )}
          <Pagination
            page={accountPage}
            total={accounts.data?.data?.total ?? accountRows.length}
            limit={20}
            onPage={setAccountPage}
          />
          {selectedAccountId ? (
            <AccountDetail
              account={accountDetail.data?.data}
              entries={accountEntries.data?.data?.items ?? []}
              pending={accountDetail.isPending || accountEntries.isPending}
              error={accountDetail.error || accountEntries.error}
              onClose={() => setSelectedAccountId(null)}
            />
          ) : null}
        </section>
      ) : null}

      {!journals.isPending && !error && tab === "Journals" ? (
        <section className="card">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-semibold">Immutable journals</h2>
              <p className="mt-1 text-xs text-slate-500">
                Search by journal reference or source event identifier.
              </p>
            </div>
            <form
              className="flex gap-2"
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
                placeholder="JRN-… or source ID"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <button className="btn-secondary" type="submit">
                Search
              </button>
            </form>
          </div>
          {journalRows.length ? (
            <JournalTable
              rows={journalRows}
              onSelect={setSelectedJournal}
              accounts={accountMap}
            />
          ) : (
            <Empty text="No journals match this currency and search." />
          )}
          <Pagination
            page={journalPage}
            total={journalTotal}
            limit={20}
            onPage={setJournalPage}
          />
          {selectedJournal ? (
            <JournalDetail
              journal={selectedJournal}
              accounts={accountMap}
              onClose={() => setSelectedJournal(null)}
            />
          ) : null}
        </section>
      ) : null}

      {tab === "Integrity" ? (
        <IntegrityPanel
          reports={reports.data?.data?.items ?? []}
          pending={reports.isPending}
          canRun={canRun}
          runCheck={runCheck}
          currency={currency}
        />
      ) : null}
      {tab === "Reconciliation" ? (
        <ReconciliationPanel query={reconciliation} />
      ) : null}
    </div>
  );
}

function JournalTable({ rows, onSelect }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="py-3">Reference</th>
            <th>Event</th>
            <th>Debit</th>
            <th>Credit</th>
            <th>Currency</th>
            <th>Posted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((journal) => {
            const debit = journal.entries
              .filter((e) => e.direction === "DEBIT")
              .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
            const credit = journal.entries
              .filter((e) => e.direction === "CREDIT")
              .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
            return (
              <tr
                key={journal.id}
                onClick={() => onSelect(journal)}
                className="cursor-pointer border-t border-slate-100 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-950/20"
              >
                <td className="py-3 pr-4 font-mono text-xs text-blue-700">
                  {journal.journalReference}
                </td>
                <td>{journal.eventType}</td>
                <td className="font-mono text-xs text-slate-500">
                  {journal.paymentId ?? journal.sourceId}
                </td>
                <td>{formatMinorUnits(debit.toString(), journal.currency)}</td>
                <td>{formatMinorUnits(credit.toString(), journal.currency)}</td>
                <td>{journal.currency}</td>
                <td>{new Date(journal.postedAt).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function JournalDetail({ journal, accounts = new Map(), onClose }) {
  return (
    <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex justify-between">
        <div>
          <p className="font-mono text-xs text-blue-700">
            {journal.journalReference}
          </p>
          <h3 className="mt-1 font-semibold">Debit / credit breakdown</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Source: {journal.sourceType} ·{" "}
            {journal.paymentId ?? journal.sourceId}
          </p>
        </div>
        <button
          className="text-sm font-semibold text-blue-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {journal.entries.map((entry, index) => (
          <div
            key={`${entry.accountId}-${index}`}
            className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-xl bg-white p-3 text-sm dark:bg-slate-900"
          >
            <span className="text-xs">
              <strong className="block">
                {accounts.get(entry.accountId)?.accountName ?? "Account"}
              </strong>
              <span className="font-mono text-slate-500">
                {accounts.get(entry.accountId)?.accountCode ?? entry.accountId}
              </span>
            </span>
            <span>{entry.direction}</span>
            <strong>
              {formatMinorUnits(entry.amountMinor, journal.currency)}
            </strong>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Posted journals are immutable. Corrections require linked compensating
        journals.
      </p>
    </div>
  );
}

function IntegrityPanel({ reports, pending, canRun, runCheck, currency }) {
  const latest = reports[0];
  return (
    <section className="space-y-4">
      <div className="card flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">Pratyaya Ledger Integrity Guardian</p>
          <h2 className="mt-2 text-xl font-bold">
            {latest?.status ?? "No verification run"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            A pass covers only the checks and records examined.
          </p>
        </div>
        {canRun ? (
          <button
            className="btn-primary"
            disabled={runCheck.isPending}
            onClick={() => runCheck.mutate()}
          >
            <RefreshCw
              className={`h-4 w-4 ${runCheck.isPending ? "animate-spin" : ""}`}
            />
            Run verification
          </button>
        ) : (
          <p className="text-xs text-slate-500">
            Admin or auditor permission is required to run checks.
          </p>
        )}
      </div>
      {pending ? (
        <Loading />
      ) : latest ? (
        <div className="card">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Passed"
              value={String(latest.summary.passed)}
              icon={CheckCircle2}
            />
            <Metric
              label="Failed"
              value={String(latest.summary.failed)}
              icon={AlertTriangle}
            />
            <Metric
              label="Inconclusive"
              value={String(latest.summary.inconclusive)}
              icon={RefreshCw}
            />
          </div>
          <div className="mt-5 space-y-2">
            {latest.checks.map((check) => (
              <div
                key={check.checkId}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{check.checkName}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${check.status === "PASS" ? "bg-emerald-100 text-emerald-700" : check.status === "FAIL" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {check.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {check.affectedRecords} affected · {check.severity} ·{" "}
                  {check.remediation}
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
  if (query.error) return <Failure error={query.error} />;
  const rows = query.data?.data?.items ?? [];
  const summary = query.data?.data?.summary ?? {};
  return (
    <section className="card">
      <h2 className="font-semibold">Reconciliation workspace</h2>
      <p className="mt-1 text-xs text-amber-700">
        Provider comparison records are trusted synthetic fixtures until live
        simulator integration is enabled.
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
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-3 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-4 dark:border-slate-800"
            >
              <div>
                <p className="text-xs text-slate-500">Provider reference</p>
                <p className="font-mono">
                  {row.providerReference ?? "Missing"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Internal / external</p>
                <p>
                  {row.internalPaymentStatus ?? "—"} /{" "}
                  {row.externalProviderStatus ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Expected / observed</p>
                <p>
                  {formatMinorUnits(row.expectedAmountMinor, row.currency)} /{" "}
                  {formatMinorUnits(row.observedAmountMinor, row.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="font-semibold">{row.status}</p>
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

function Pagination({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-xs text-slate-500">
        Page {page} of {pages} · {total} records
      </p>
      <div className="flex gap-2">
        <button
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className="btn-secondary"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function AccountDetail({ account, entries, pending, error, onClose }) {
  return (
    <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Account detail
          </p>
          <h3 className="mt-1 font-semibold">
            {account?.accountName ?? "Account"}
          </h3>
        </div>
        <button
          className="text-sm font-semibold text-blue-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {pending ? (
        <p className="mt-4 text-sm text-slate-500">Loading account activity…</p>
      ) : error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error.message}
        </p>
      ) : (
        <>
          {account ? (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-500">Code</dt>
                <dd className="font-mono">{account.accountCode}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Type</dt>
                <dd>{account.accountType}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Debit</dt>
                <dd>
                  {formatMinorUnits(account.debitMinor, account.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Net balance</dt>
                <dd className="font-semibold">
                  {formatMinorUnits(account.netMinor, account.currency)}
                </dd>
              </div>
            </dl>
          ) : null}
          <div className="mt-4 space-y-2">
            {entries.length ? (
              entries.map((entry, index) => (
                <div
                  key={`${entry.journalId}-${index}`}
                  className="grid gap-2 rounded-xl bg-white p-3 text-xs sm:grid-cols-4 dark:bg-slate-900"
                >
                  <span className="font-mono">{entry.journalReference}</span>
                  <span>{entry.eventType}</span>
                  <span>{entry.direction}</span>
                  <strong>
                    {formatMinorUnits(entry.amountMinor, account?.currency)}
                  </strong>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No posted entries use this account.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
      {text}
    </div>
  );
}

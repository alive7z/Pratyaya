
import { ArrowRight, RefreshCw, Server, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import StatusBadge from "../../components/StatusBadge.jsx";
import { formatTime } from "../../lib/format.js";

const STATUS = {
  ready: { label: "Ready", tone: "ready" },
  degraded: { label: "Degraded", tone: "degraded" },
  unreachable: { label: "Unreachable", tone: "unreachable" },
  checking: { label: "Checking", tone: "checking" },
};

export default function HealthSnapshot({ health }) {
  const {
    overall = "checking",
    readinessData,
    isLoading = false,
    isOffline = false,
    error,
    lastUpdatedAt,
    refetch,
  } = health ?? {};

  const database = readinessData?.checks?.database;
  const status = STATUS[overall] ?? STATUS.checking;

  const databaseStatus = isLoading
    ? "checking"
    : database?.status === "up"
      ? "ready"
      : database?.status === "down"
        ? "unreachable"
        : "checking";

  const databaseLabel =
    databaseStatus === "ready"
      ? "Up"
      : databaseStatus === "unreachable"
        ? "Down"
        : "Unknown";

  return (
    <section
      className="card min-w-0"
      aria-labelledby="foundation-status-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Live Backend Status</p>
          <h2
            id="foundation-status-heading"
            className="mt-2 text-xl font-bold tracking-tight text-slate-950 dark:text-white"
          >
            Foundation Health
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Live API availability and dependency readiness.
          </p>
        </div>

        <StatusBadge tone={status.tone}>
          {status.label}
        </StatusBadge>
      </div>

      {isOffline ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
        >
          <WifiOff
            className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Backend Unreachable
            </p>
            <p className="mt-1 wrap-break-word text-xs leading-5 text-red-600 dark:text-red-400">
              {error?.message ??
                "The API is currently unavailable. Check your backend connection."}
            </p>

            <button
              type="button"
              onClick={() => refetch?.()}
              disabled={isLoading || typeof refetch !== "function"}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-slate-950 dark:text-red-300"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isLoading ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              />
              Retry Connection
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="flex min-h-28 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              API Process
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Server
                  className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Express API
                </span>
              </div>

              <StatusBadge
                tone={
                  isLoading
                    ? "checking"
                    : overall === "unreachable"
                      ? "unreachable"
                      : "ready"
                }
              >
                {isLoading
                  ? "Checking"
                  : overall === "unreachable"
                    ? "Down"
                    : "Live"}
              </StatusBadge>
            </div>
          </div>

          <div className="flex min-h-28 flex-col justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Database
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="min-w-0 text-sm font-semibold text-slate-900 dark:text-white">
                MongoDB
              </span>

              <StatusBadge tone={databaseStatus}>
                {databaseLabel}
              </StatusBadge>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last checked:{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {lastUpdatedAt ? formatTime(lastUpdatedAt) : "Not yet checked"}
          </span>
        </p>

        <Link
          to="/health"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Open System Health
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

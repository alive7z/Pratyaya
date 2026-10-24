import { ArrowRight, Server, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import StatusBadge from "../../components/StatusBadge.jsx";
import { formatTime } from "../../lib/format.js";

const overallLabels = {
  ready: "Ready",
  degraded: "Degraded",
  unreachable: "Unreachable",
  checking: "Checking",
};

const overallTones = {
  ready: "ready",
  degraded: "degraded",
  unreachable: "unreachable",
  checking: "checking",
};

export default function HealthSnapshot({ health }) {
  const {
    overall,
    readinessData,
    isLoading,
    isOffline,
    error,
    lastUpdatedAt,
    refetch,
  } = health;
  const database = readinessData?.checks?.database;

  return (
    <section className="card" aria-labelledby="foundation-status-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Live backend status</p>
          <h2
            id="foundation-status-heading"
            className="mt-2 text-xl font-bold tracking-tight text-slate-900"
          >
            Foundation health
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Read directly from the API liveness and readiness endpoints.
          </p>
        </div>
        <StatusBadge tone={overallTones[overall]}>
          {overallLabels[overall]}
        </StatusBadge>
      </div>

      {isOffline ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <WifiOff
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-800">
              The API is not reachable
            </p>
            <p className="mt-1 text-xs leading-5 text-rose-700">
              {error?.message ?? "Start the API and refresh this page."} Run{" "}
              <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px]">
                npm run dev
              </code>{" "}
              or start Docker Compose.
            </p>
            <button
              type="button"
              onClick={refetch}
              className="btn-secondary mt-3"
            >
              Retry connection
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-medium text-slate-500">API process</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Server aria-hidden="true" className="h-4 w-4 text-blue-600" />
                Express
              </span>
              <StatusBadge tone={isLoading ? "checking" : "ready"}>
                {isLoading ? "Checking" : "Live"}
              </StatusBadge>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-medium text-slate-500">MongoDB</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Replica-set storage
              </span>
              <StatusBadge
                tone={
                  database?.status === "up"
                    ? "ready"
                    : database
                      ? "unreachable"
                      : "checking"
                }
              >
                {database?.status === "up"
                  ? "Up"
                  : database
                    ? "Down"
                    : "Checking"}
              </StatusBadge>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          Last checked:{" "}
          <span className="font-medium text-slate-700">
            {formatTime(lastUpdatedAt)}
          </span>
        </p>
        <Link to="/health" className="subtle-link">
          Open system health
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

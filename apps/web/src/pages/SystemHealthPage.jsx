import { Database, RefreshCw, Server, WifiOff } from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";
import DependencyRow from "../features/health/DependencyRow.jsx";
import { useHealth } from "../hooks/useHealth.js";
import { API_BASE_URL } from "../lib/apiClient.js";
import { formatTime, formatUptime } from "../lib/format.js";

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

const overallDescriptions = {
  ready: "The API and authoritative MongoDB database are responding.",
  degraded:
    "The API process is reachable, but a required dependency is unavailable.",
  unreachable: "The browser could not reach the API health endpoints.",
  checking: "Waiting for the first health response.",
};

export default function SystemHealthPage() {
  const {
    liveness,
    readiness,
    livenessData,
    readinessData,
    overall,
    isOffline,
    isLoading,
    isFetching,
    error,
    lastUpdatedAt,
    refetch,
  } = useHealth();

  const rawPayload = {
    liveness: liveness.data ?? null,
    readiness: readiness.data ?? null,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            System health
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            These values come from live API checks against MongoDB. The browser
            does not invent or cache a success state.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={refetch}
          disabled={isFetching}
        >
          <RefreshCw
            aria-hidden="true"
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          {isFetching ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <section
        aria-live="polite"
        className={`rounded-2xl border p-5 ${
          overall === "ready"
            ? "border-emerald-200 bg-emerald-50"
            : overall === "degraded"
              ? "border-amber-200 bg-amber-50"
              : overall === "unreachable"
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={overallTones[overall]}>
                {overallLabels[overall]}
              </StatusBadge>
              <span className="text-xs font-medium text-slate-500">
                Last checked {formatTime(lastUpdatedAt)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {overallDescriptions[overall]}
            </p>
          </div>
          <p className="font-mono text-xs text-slate-500">{API_BASE_URL}</p>
        </div>
      </section>

      {isOffline ? (
        <section className="card border-rose-200">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <WifiOff aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                API unreachable
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {error?.message ??
                  "The health request failed before receiving a response."}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Start the backend with{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                  npm run dev
                </code>{" "}
                or{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                  docker compose up --build
                </code>
                .
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section
          className="grid gap-6 lg:grid-cols-2"
          aria-label="Dependency health"
        >
          <div className="card">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Server aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  API process
                </h2>
                <p className="text-xs text-slate-500">
                  Liveness and runtime metadata
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-5 space-y-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            ) : (
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-slate-500">Status</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {livenessData?.status === "ok" ? "Live" : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Version
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-slate-900">
                    {livenessData?.version ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Service
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-slate-900">
                    {livenessData?.service ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Uptime</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {formatUptime(livenessData?.uptimeSeconds)}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Database aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Required infrastructure
                </h2>
                <p className="text-xs text-slate-500">
                  Readiness checks with a 2 second timeout
                </p>
              </div>
            </div>

            <div className="mt-2 divide-y divide-slate-100">
              <DependencyRow
                name="MongoDB"
                description="Authoritative state; replica set required for transactions"
                check={readinessData?.checks?.database}
                isLoading={isLoading}
              />
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">
            Endpoints in this milestone
          </h2>
          <ul className="mt-4 space-y-3">
            {[
              ["GET", "/api/v1/health/live"],
              ["GET", "/api/v1/health/ready"],
              ["GET", "/api/v1/system/info"],
              ["GET", "/api-docs"],
            ].map(([method, path]) => (
              <li key={path} className="flex items-center gap-3">
                <span className="w-10 rounded bg-blue-50 px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold text-blue-700">
                  {method}
                </span>
                <code className="text-xs text-slate-700">{path}</code>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Payment, ledger, reconciliation, chaos, and AgentPay paths are
            intentionally absent until their milestones are implemented and
            tested.
          </p>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">
            Raw health response
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Useful when checking request IDs and exact dependency payloads.
          </p>
          <pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-5 text-slate-200">
            {JSON.stringify(rawPayload, null, 2)}
          </pre>
        </div>
      </section>
    </div>
  );
}

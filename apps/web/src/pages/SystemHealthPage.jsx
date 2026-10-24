
import {
  Database,
  RefreshCw,
  Server,
  WifiOff,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock3,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";
import DependencyRow from "../features/health/DependencyRow.jsx";
import { useHealth } from "../hooks/useHealth.js";
import { API_BASE_URL } from "../lib/apiClient.js";
import { formatTime, formatUptime } from "../lib/format.js";
import { cn } from "../lib/utils.js";

const statusConfig = {
  ready: {
    label: "Ready",
    description:
      "The API and authoritative MongoDB database are responding.",
    classes:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
    icon: CheckCircle2,
  },
  degraded: {
    label: "Degraded",
    description:
      "The API is reachable, but a required dependency is unavailable.",
    classes:
      "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
    icon: AlertTriangle,
  },
  unreachable: {
    label: "Unreachable",
    description:
      "The browser could not reach the API health endpoints.",
    classes:
      "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30",
    icon: WifiOff,
  },
  checking: {
    label: "Checking",
    description: "Waiting for the first health response.",
    classes:
      "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
    icon: Clock3,
  },
};

const cardClass = cn(
  "rounded-xl border border-slate-200",
  "bg-white p-5 shadow-sm",
  "dark:border-slate-800 dark:bg-slate-950",
  "sm:p-6",
);

const endpoints = [
  ["GET", "/api/v1/health/live"],
  ["GET", "/api/v1/health/ready"],
  ["GET", "/api/v1/system/info"],
  ["GET", "/api-docs"],
];

function Detail({ label, children, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 wrap-break-word text-sm font-semibold text-slate-900 dark:text-white",
          mono && "font-mono text-xs",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function HealthLoading() {
  return (
    <div
      role="status"
      aria-label="Loading service health"
      className="mt-5 grid grid-cols-2 gap-4"
    >
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
        </div>
      ))}
    </div>
  );
}

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

  const currentStatus = statusConfig[overall] ?? statusConfig.checking;

  const rawPayload = {
    liveness: liveness.data ?? null,
    readiness: readiness.data ?? null,
  };

  const handleRefresh = () => {
    if (!isFetching) refetch();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Operations</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            System Health
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Monitor API availability, runtime information,
            and MongoDB connectivity using live health checks.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching}
          className="btn-secondary"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              isFetching && "animate-spin",
            )}
            aria-hidden="true"
          />
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <section
        aria-label="Overall system status"
        aria-live="polite"
        className={cn(
          "rounded-xl border p-5 sm:p-6",
          currentStatus.classes,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                tone={overall}
                pulse={overall === "checking"}
              >
                {currentStatus.label}
              </StatusBadge>

              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Clock3
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                Last checked: {formatTime(lastUpdatedAt)}
              </span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {currentStatus.description}
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
            <Server
              className="h-4 w-4 shrink-0 text-slate-500"
              aria-hidden="true"
            />
            <code className="break-all text-xs text-slate-600 dark:text-slate-300">
              {API_BASE_URL}
            </code>
          </div>
        </div>
      </section>

      {isOffline && (
        <section
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/30"
        >
          <div className="flex items-start gap-3">
            <WifiOff
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
              aria-hidden="true"
            />

            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                API unreachable
              </h2>

              <p className="mt-1 text-sm leading-relaxed text-rose-700 dark:text-rose-300">
                {error?.message ??
                  "The health request failed before receiving a response."}
              </p>

              <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Verify that the backend is running, the API
                port is configured correctly, and MongoDB
                is accessible.
              </p>
            </div>
          </div>
        </section>
      )}

      <section
        aria-label="Dependency health"
        className="grid gap-5 lg:grid-cols-2"
      >
        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Server className="h-5 w-5" aria-hidden="true" />
            </span>

            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                API Process
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Liveness and runtime metadata
              </p>
            </div>
          </div>

          {isLoading ? (
            <HealthLoading />
          ) : (
            <dl className="mt-6 grid grid-cols-2 gap-5">
              <Detail label="Status">
                <span className="flex items-center gap-2">
                  <Activity
                    className={cn(
                      "h-4 w-4",
                      livenessData?.status === "ok"
                        ? "text-emerald-500"
                        : "text-rose-500",
                    )}
                    aria-hidden="true"
                  />
                  {livenessData?.status === "ok"
                    ? "Live"
                    : "Unavailable"}
                </span>
              </Detail>

              <Detail label="Version" mono>
                {livenessData?.version ?? "—"}
              </Detail>

              <Detail label="Service" mono>
                {livenessData?.service ?? "—"}
              </Detail>

              <Detail label="Uptime">
                {formatUptime(livenessData?.uptimeSeconds)}
              </Detail>
            </dl>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Database className="h-5 w-5" aria-hidden="true" />
            </span>

            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                Required Infrastructure
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dependency readiness checks
              </p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            <DependencyRow
              name="MongoDB"
              description="Authoritative database with transaction support"
              check={readinessData?.checks?.database}
              isLoading={isLoading}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">
            API Endpoints
          </h2>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Health, service information, and API documentation.
          </p>

          <ul className="mt-5 space-y-3">
            {endpoints.map(([method, path]) => (
              <li
                key={path}
                className="flex min-w-0 items-center gap-3"
              >
                <span className="w-11 shrink-0 rounded-md bg-blue-50 px-2 py-1 text-center font-mono text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                  {method}
                </span>

                <code className="min-w-0 break-all text-xs text-slate-700 dark:text-slate-300">
                  {path}
                </code>
              </li>
            ))}
          </ul>
        </div>

        <div className={cardClass}>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">
            Raw Health Response
          </h2>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Inspect the exact API response for debugging.
          </p>

          <pre className="mt-5 max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
            {JSON.stringify(rawPayload, null, 2)}
          </pre>
        </div>
      </section>
    </div>
  );
}

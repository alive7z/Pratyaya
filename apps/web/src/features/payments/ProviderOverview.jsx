import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Server } from "lucide-react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";

const percent = (value) =>
  Number.isFinite(Number(value)) && value != null
    ? `${(Number(value) * 100).toFixed(2)}%`
    : "—";

const milliseconds = (value) =>
  value != null && Number.isFinite(Number(value))
    ? `${Math.round(Number(value))} ms`
    : "—";

function Metric({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="wrap-break-word text-right font-medium">
        {value || "—"}
      </span>
    </div>
  );
}

export function ProviderOverview() {
  const { auth } = useAuth();

  const { data, isPending, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["providers", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/routing/providers"),
    enabled: Boolean(auth),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const payload = data?.data?.data ?? data?.data;
  const providers = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.providers)
      ? payload.providers
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Provider Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Monitor provider configuration, routing, and health metrics.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={!auth || isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </header>

      {!auth ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            Sign in or start a demo session to view providers.
          </CardContent>
        </Card>
      ) : isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {error?.message || "Unable to load providers."}
        </div>
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Server className="h-10 w-10 text-slate-400" />
            <h2 className="mt-4 font-semibold">No providers configured</h2>
            <p className="mt-2 text-sm text-slate-500">
              Provider configurations will appear here when available.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => {
            const availability = Number(provider.healthMetrics?.availability);
            const hasAvailability =
              provider.healthMetrics?.availability != null &&
              Number.isFinite(availability);

            const healthy =
              provider.enabled !== false &&
              hasAvailability &&
              availability >= 0.95;

            const circuit = provider.circuitBreaker;

            return (
              <Card key={provider.providerId} className="min-w-0">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <Server className="h-5 w-5" aria-hidden="true" />
                      </span>

                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {provider.providerName ?? provider.providerId}
                        </CardTitle>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">
                          {provider.providerId}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={
                        provider.enabled === false
                          ? "secondary"
                          : !hasAvailability
                            ? "secondary"
                            : healthy
                              ? "success"
                              : "warning"
                      }
                    >
                      {provider.enabled === false
                        ? "Disabled"
                        : !hasAvailability
                          ? "Unknown"
                          : healthy
                            ? "Healthy"
                            : "Degraded"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Metric
                      label="Availability"
                      value={percent(provider.healthMetrics?.availability)}
                    />
                    <Metric
                      label="P50 Latency"
                      value={milliseconds(provider.healthMetrics?.latencyP50Ms)}
                    />
                    <Metric
                      label="Error Rate"
                      value={percent(provider.healthMetrics?.errorRate)}
                    />
                    <Metric
                      label="Timeout Rate"
                      value={percent(provider.healthMetrics?.timeoutRate)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <span className="text-sm font-medium">Circuit Breaker</span>
                    <Badge
                      variant={
                        circuit?.state === "CLOSED"
                          ? "success"
                          : circuit?.state === "OPEN"
                            ? "destructive"
                            : circuit?.state === "HALF_OPEN"
                              ? "warning"
                              : "secondary"
                      }
                    >
                      {circuit?.state?.replaceAll("_", " ") ?? "Unknown"}
                    </Badge>
                  </div>

                  <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <Detail
                      label="Currencies"
                      value={provider.supportedCurrencies?.join(", ")}
                    />
                    <Detail
                      label="Operations"
                      value={provider.supportedOperations?.join(", ")}
                    />
                    <Detail
                      label="Routing Weight"
                      value={
                        provider.routingWeight != null
                          ? String(provider.routingWeight)
                          : null
                      }
                    />
                    <Detail label="Status" value={provider.status} />
                    {circuit?.nextProbeAt && (
                      <Detail
                        label="Next Probe"
                        value={new Date(circuit.nextProbeAt).toLocaleString()}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProviderOverview;

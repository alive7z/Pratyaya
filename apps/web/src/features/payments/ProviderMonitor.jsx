
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { RefreshCw, Server, CheckCircle2, XCircle, AlertTriangle, Clock3 } from "lucide-react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";

const statusVariants = {
  SUCCEEDED: "success",
  DECLINED: "destructive",
  UNKNOWN_TO_CLIENT: "warning",
  RECEIVED: "secondary",
  PROCESSING: "info",
};

function getItems(response, key) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  return data?.[key] ?? data?.items ?? [];
}

function latency(operation) {
  const start = Date.parse(operation.processingStartedAt);
  const end = Date.parse(operation.processingCompletedAt);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? end - start
    : null;
}

function Metric({ label, value, icon: Icon }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 pt-5">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      </CardContent>
    </Card>
  );
}

export function ProviderMonitor() {
  const { auth } = useAuth();
  const enabled = Boolean(auth);
  const merchantId = auth?.merchantId ?? auth?.merchant?.id;

  const operations = useQuery({
    queryKey: ["provider-operations", merchantId],
    queryFn: () => apiClient.get("/api/v1/sandbox/provider-operations?limit=50"),
    enabled,
    refetchInterval: 15000,
  });

  const health = useQuery({
    queryKey: ["provider-health", merchantId],
    queryFn: () => apiClient.get("/api/v1/routing/providers"),
    enabled,
    refetchInterval: 30000,
  });

  const ops = getItems(operations.data, "operations");
  const providers = getItems(health.data, "providers");
  const latencies = ops.map(latency).filter((value) => value !== null);
  const averageLatency = latencies.length
    ? `${Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)} ms`
    : "—";

  const metrics = [
    ["Recent Operations", ops.length, Server],
    ["Successful", ops.filter((op) => op.status === "SUCCEEDED").length, CheckCircle2],
    ["Failed", ops.filter((op) => op.status === "DECLINED").length, XCircle],
    ["Unknown", ops.filter((op) => op.status === "UNKNOWN_TO_CLIENT").length, AlertTriangle],
    ["Average Latency", averageLatency, Clock3],
  ];

  const loading = enabled && (operations.isPending || health.isPending);
  const fetching = operations.isFetching || health.isFetching;
  const error = operations.error || health.error;

  const refresh = () => {
    operations.refetch();
    health.refetch();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Provider Monitor
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Monitor simulated provider operations and routing availability.
          </p>
        </div>
        <Button variant="outline" disabled={!enabled || fetching} onClick={refresh}>
          <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {!enabled ? (
        <Card>
          <CardContent className="py-8 text-center text-sm">
            <p>Sign in to view provider activity.</p>
            <Link to="/login" className="mt-2 inline-block font-medium text-blue-600">
              Sign in
            </Link>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map(([label]) => (
            <div key={label} className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error.message || "Unable to load provider data."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {metrics.map(([label, value, Icon]) => (
              <Metric key={label} label={label} value={value} icon={Icon} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Configured Providers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {providers.length ? providers.map((provider) => (
                  <div
                    key={provider.providerId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{provider.providerName ?? provider.providerId}</p>
                      <p className="truncate font-mono text-xs text-slate-500">{provider.providerId}</p>
                    </div>
                    <Badge variant={provider.enabled ? "success" : "secondary"}>
                      {provider.status ?? (provider.enabled ? "Enabled" : "Disabled")}
                    </Badge>
                  </div>
                )) : (
                  <p className="py-6 text-center text-sm text-slate-500">No providers configured.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {ops.length ? ops.slice(0, 20).map((op) => (
                    <div
                      key={op.operationId}
                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{op.type ?? "Operation"}</p>
                        <p className="truncate font-mono text-xs text-slate-500">{op.operationId}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge variant={statusVariants[op.status] ?? "secondary"}>
                          {op.status ?? "UNKNOWN"}
                        </Badge>
                        <p className="mt-1 text-xs text-slate-500">
                          {latency(op) !== null ? `${latency(op)} ms` : "—"}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <p className="py-6 text-center text-sm text-slate-500">
                      No provider operations recorded.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default ProviderMonitor;

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";

export function ProviderMonitor() {
  const { auth } = useAuth();

  const { data: providerOps, isLoading: opsLoading } = useQuery({
    queryKey: ["provider-operations", auth?.merchantId],
    queryFn: () =>
      apiClient.get("/api/v1/sandbox/provider-operations?limit=50"),
    enabled: !!auth,
  });

  const { data: providerHealth, isLoading: healthLoading } = useQuery({
    queryKey: ["provider-health"],
    queryFn: () => apiClient.get("/api/v1/routing/providers"),
    enabled: !!auth,
    refetchInterval: 30000,
  });

  const loading = opsLoading || healthLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="h-8 bg-gray-200 animate-pulse rounded w-1/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const ops = providerOps?.data?.operations || [];
  const providers = providerHealth?.data ?? [];
  const healthy = providers.length > 0 && providers.every((p) => p.enabled);

  const successCount = ops.filter((o) => o.status === "SUCCEEDED").length;
  const failedCount = ops.filter((o) => o.status === "DECLINED").length;
  const unknownCount = ops.filter(
    (o) => o.status === "UNKNOWN_TO_CLIENT",
  ).length;

  const avgLatency =
    ops
      .filter((o) => o.processingCompletedAt && o.processingStartedAt)
      .reduce(
        (sum, o) =>
          sum +
          (new Date(o.processingCompletedAt).getTime() -
            new Date(o.processingStartedAt).getTime()),
        0,
      ) /
    Math.max(
      1,
      ops.filter((o) => o.processingCompletedAt && o.processingStartedAt)
        .length,
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider Monitor</h1>
          <p className="text-gray-500 mt-1">
            Real-time provider connection health and operation metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${healthy ? "bg-green-500" : "bg-yellow-500"}`}
          />
          <span className="text-sm font-medium">
            {healthy ? "Available" : "Needs attention"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ops.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {successCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Unknown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {unknownCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgLatency)}ms</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configured providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {providers.map((provider) => (
                <div
                  key={provider.providerId}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{provider.providerName}</p>
                    <p className="text-xs text-gray-500">
                      {provider.providerId}
                    </p>
                  </div>
                  <Badge variant={provider.enabled ? "success" : "destructive"}>
                    {provider.status}
                  </Badge>
                </div>
              ))}
              {providers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No providers are configured.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {ops.slice(0, 20).map((op) => (
                <div
                  key={op.operationId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${getStatusColor(op.status)}`}
                    />
                    <div>
                      <p className="font-medium text-sm">{op.type}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {op.operationId}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={getStatusVariant(op.status)}>
                      {op.status}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {op.processingCompletedAt && op.processingStartedAt
                        ? `${new Date(op.processingCompletedAt).getTime() - new Date(op.processingStartedAt).getTime()}ms`
                        : "—"}
                    </p>
                  </div>
                </div>
              ))}
              {ops.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  No provider operations yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getStatusVariant(status) {
  const variants = {
    SUCCEEDED: "success",
    DECLINED: "destructive",
    UNKNOWN_TO_CLIENT: "destructive",
    RECEIVED: "secondary",
    PROCESSING: "default",
  };
  return variants[status] || "secondary";
}

function getStatusColor(status) {
  const colors = {
    SUCCEEDED: "bg-green-500",
    DECLINED: "bg-red-500",
    UNKNOWN_TO_CLIENT: "bg-yellow-500",
    RECEIVED: "bg-gray-400",
    PROCESSING: "bg-blue-500",
  };
  return colors[status] || "bg-gray-400";
}

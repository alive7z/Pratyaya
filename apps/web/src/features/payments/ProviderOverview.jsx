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
import { Loader2, Server } from "lucide-react";

const PROVIDER_COLORS = {
  alpha: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: "bg-blue-100 text-blue-600",
  },
  beta: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    icon: "bg-green-100 text-green-600",
  },
  gamma: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    icon: "bg-purple-100 text-purple-600",
  },
};

export function ProviderOverview() {
  const { auth } = useAuth();

  const {
    data: providersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["providers"],
    queryFn: () => apiClient.get("/api/v1/routing/providers"),
    enabled: !!auth,
    refetchInterval: 30000,
  });

  const providers = providersData?.data || [];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
              <div className="h-8 bg-gray-200 animate-pulse rounded w-full mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-12">
        <Server className="h-12 w-12 mx-auto text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          No providers configured
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Configure providers in the sandbox environment
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Provider Overview
          </h1>
          <p className="text-gray-500 mt-1">
            Multi-provider health and configuration status
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary"
          disabled={isLoading}
        >
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {providers.map((provider) => {
          const colors =
            PROVIDER_COLORS[provider.providerId] || PROVIDER_COLORS.alpha;
          const isHealthy = provider.healthMetrics?.availability >= 0.95;
          const circuitBreaker = provider.circuitBreaker;

          return (
            <Card
              key={provider.providerId}
              className={`${colors.border} ${colors.bg}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`${colors.icon} p-3 rounded-xl`}>
                      <Server className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg capitalize">
                        {provider.providerId}
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        {provider.providerName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isHealthy ? "success" : "destructive"}>
                      {isHealthy ? "Healthy" : "Degraded"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-white/50 border">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Availability
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(provider.healthMetrics?.availability * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/50 border">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Avg Latency
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {provider.healthMetrics?.latencyP50Ms?.toFixed(0) ?? "—"}
                      ms
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/50 border">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Error Rate
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(provider.healthMetrics?.errorRate * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/50 border">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Timeout Rate
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(provider.healthMetrics?.timeoutRate * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white/50 border">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        circuitBreaker?.state === "CLOSED"
                          ? "bg-green-500"
                          : circuitBreaker?.state === "OPEN"
                            ? "bg-red-500"
                            : "bg-yellow-500"
                      }`}
                    />
                    <span className="text-sm font-medium capitalize">
                      Circuit:{" "}
                      {circuitBreaker?.state?.toLowerCase() ?? "closed"}
                    </span>
                  </div>
                  {circuitBreaker?.nextProbeAt && (
                    <span className="text-xs text-gray-500">
                      Next probe:{" "}
                      {new Date(
                        circuitBreaker.nextProbeAt,
                      ).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Supported Currencies</span>
                    <span className="font-medium">
                      {provider.supportedCurrencies?.join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Supported Operations</span>
                    <span className="font-medium">
                      {provider.supportedOperations?.join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Routing Weight</span>
                    <span className="font-medium">
                      {provider.routingWeight}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <Badge
                      variant={
                        provider.status === "ACTIVE" ? "success" : "secondary"
                      }
                    >
                      {provider.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

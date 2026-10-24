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
import { Button } from "../../components/ui/Button.jsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/Alert.jsx";
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Zap,
} from "lucide-react";

function formatTimeAgo(dateString) {
  if (!dateString) return "Never";
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getStateColor(state) {
  switch (state) {
    case "CLOSED":
      return "bg-green-500";
    case "OPEN":
      return "bg-red-500";
    case "HALF_OPEN":
      return "bg-yellow-500";
    default:
      return "bg-gray-400";
  }
}

function getStateVariant(state) {
  switch (state) {
    case "CLOSED":
      return "success";
    case "OPEN":
      return "destructive";
    case "HALF_OPEN":
      return "default";
    default:
      return "secondary";
  }
}

function getStateIcon(state) {
  switch (state) {
    case "CLOSED":
      return <CheckCircle className="h-4 w-4" />;
    case "OPEN":
      return <XCircle className="h-4 w-4" />;
    case "HALF_OPEN":
      return <Zap className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

export function CircuitBreakerMonitor() {
  const { auth } = useAuth();

  const {
    data: breakersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["circuit-breakers"],
    queryFn: () => apiClient.get("/api/v1/routing/circuit-breakers"),
    enabled: !!auth,
    refetchInterval: 10000,
  });

  const breakers = breakersData?.data || [];

  if (isLoading) {
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

  if (breakers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Circuit Breaker Monitor
            </h1>
            <p className="text-gray-500 mt-1">
              Monitor and manage provider circuit breaker states
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No circuit breakers configured
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Circuit breakers are created automatically when providers are used
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Circuit Breaker Monitor
          </h1>
          <p className="text-gray-500 mt-1">
            Real-time circuit breaker states and failure tracking
          </p>
        </div>
        <Button onClick={() => refetch()}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {breakers.map((breaker) => (
          <Card
            key={`${breaker.providerId}-${breaker.operationType}`}
            className="relative"
          >
            <div className="absolute top-3 right-3">
              <div
                className={`w-3 h-3 rounded-full ${getStateColor(breaker.state)}`}
              />
            </div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100">
                    <Shield className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg capitalize">
                      {breaker.providerId}
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      {breaker.operationType} operations
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStateVariant(breaker.state)}>
                    {getStateIcon(breaker.state)}
                    {breaker.state}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Failure Threshold
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {breaker.failureThreshold}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Current Failures
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {breaker.failureCount}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Success Threshold
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {breaker.successThreshold}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Success Count
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {breaker.successCount}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-gray-500">Total Requests</span>
                  <span className="font-medium text-gray-900">
                    {breaker.totalRequests ?? 0}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-gray-500">Failed Requests</span>
                  <span className="font-medium text-red-600">
                    {breaker.failedRequests ?? 0}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-gray-500">Timeout</span>
                  <span className="font-medium text-gray-900">
                    {(breaker.timeoutMs / 1000).toFixed(0)}s
                  </span>
                </div>
              </div>

              {breaker.state === "OPEN" && breaker.nextProbeAt && (
                <Alert
                  variant="destructive"
                  className="border-red-200 bg-red-50"
                >
                  <AlertTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Circuit Breaker OPEN
                  </AlertTitle>
                  <AlertDescription>
                    Next probe available:{" "}
                    {new Date(breaker.nextProbeAt).toLocaleString()} (
                    {formatTimeAgo(breaker.nextProbeAt)})
                  </AlertDescription>
                </Alert>
              )}

              {breaker.state === "HALF_OPEN" && (
                <Alert
                  variant="warning"
                  className="border-yellow-200 bg-yellow-50"
                >
                  <AlertTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Circuit Breaker HALF_OPEN
                  </AlertTitle>
                  <AlertDescription>
                    {breaker.halfOpenLeaseOwner
                      ? `Probe leased by: ${breaker.halfOpenLeaseOwner}`
                      : "Available for probe"}
                    {breaker.halfOpenLeaseExpiresAt && (
                      <>
                        <br />
                        Lease expires:{" "}
                        {new Date(
                          breaker.halfOpenLeaseExpiresAt,
                        ).toLocaleTimeString()}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex justify-between">
                  <span>Last State Change</span>
                  <span className="font-medium">
                    {breaker.lastStateChangeAt
                      ? formatTimeAgo(breaker.lastStateChangeAt)
                      : "Never"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Last Failure</span>
                  <span className="font-medium">
                    {breaker.lastFailureAt
                      ? formatTimeAgo(breaker.lastFailureAt)
                      : "Never"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Details
                </Button>
                {breaker.state !== "CLOSED" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={async () => {
                      try {
                        await apiClient.post(
                          `/api/v1/routing/circuit-breakers/${breaker.providerId}/reset`,
                        );
                        setTimeout(() => window.location.reload(), 500);
                      } catch {
                        alert("Failed to reset circuit breaker");
                      }
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Circuit Breaker State Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border border-green-200 bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="font-medium text-green-800">CLOSED</span>
              </div>
              <p className="text-sm text-gray-600">
                Normal operation. Requests flow normally. Failures are counted.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-red-200 bg-red-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-medium text-red-800">OPEN</span>
              </div>
              <p className="text-sm text-gray-600">
                Requests blocked. Provider is considered unhealthy. Recovery
                probe scheduled.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="font-medium text-yellow-800">HALF_OPEN</span>
              </div>
              <p className="text-sm text-gray-600">
                Limited test requests allowed. Successful probes close the
                circuit; failures reopen it.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CircuitBreakerMonitor;

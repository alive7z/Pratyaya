
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock3,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiClient } from "../../lib/apiClient.js";
import { cn } from "../../lib/utils.js";
import { useAuth } from "../../app/AuthContext.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
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

const STATE_CONFIG = {
  CLOSED: {
    label: "Closed",
    variant: "success",
    icon: CheckCircle2,
    description: "Normal operation. Requests are allowed.",
  },
  OPEN: {
    label: "Open",
    variant: "destructive",
    icon: XCircle,
    description: "Requests are blocked until recovery is attempted.",
  },
  HALF_OPEN: {
    label: "Half Open",
    variant: "warning",
    icon: Zap,
    description: "Limited recovery probes are allowed.",
  },
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function formatTimeAgo(value) {
  if (!value) return "Never";

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) return "Unknown";

  const diff = Date.now() - timestamp;

  if (diff < 0) return "Upcoming";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return `${days}d ago`;
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
        {value ?? "—"}
      </p>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="text-right font-medium text-slate-900 dark:text-white">
        {value ?? "—"}
      </span>
    </div>
  );
}

function CircuitBreakerCard({ breaker, onReset, resetting }) {
  const [expanded, setExpanded] = useState(false);

  const config = STATE_CONFIG[breaker.state] ?? {
    label: breaker.state || "Unknown",
    variant: "secondary",
    icon: Clock3,
    description: "Circuit state unavailable.",
  };

  const Icon = config.icon;
  const canReset = breaker.state !== "CLOSED";

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {breaker.providerId || "Unknown provider"}
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {breaker.operationType || "Unknown"} operations
              </p>
            </div>
          </div>

          <Badge variant={config.variant} className="gap-1">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="Failure Threshold"
            value={breaker.failureThreshold}
          />
          <Metric
            label="Current Failures"
            value={breaker.failureCount}
          />
          <Metric
            label="Success Threshold"
            value={breaker.successThreshold}
          />
          <Metric
            label="Success Count"
            value={breaker.successCount}
          />
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Detail
            label="Total Requests"
            value={breaker.totalRequests ?? "—"}
          />
          <Detail
            label="Failed Requests"
            value={breaker.failedRequests ?? "—"}
          />
          <Detail
            label="Timeout"
            value={
              Number.isFinite(Number(breaker.timeoutMs))
                ? `${Number(breaker.timeoutMs) / 1000}s`
                : "—"
            }
          />
        </div>

        {breaker.state === "OPEN" && (
          <Alert variant="destructive">
            <AlertTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Circuit Open
            </AlertTitle>
            <AlertDescription>
              {breaker.nextProbeAt
                ? `Next probe: ${formatDate(breaker.nextProbeAt)}`
                : "Requests are currently blocked."}
            </AlertDescription>
          </Alert>
        )}

        {breaker.state === "HALF_OPEN" && (
          <Alert variant="warning">
            <AlertTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Recovery In Progress
            </AlertTitle>
            <AlertDescription>
              {breaker.halfOpenLeaseOwner
                ? `Probe leased by ${breaker.halfOpenLeaseOwner}`
                : "Waiting for a recovery probe."}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Detail
            label="Last State Change"
            value={formatTimeAgo(breaker.lastStateChangeAt)}
          />
          <Detail
            label="Last Failure"
            value={formatTimeAgo(breaker.lastFailureAt)}
          />
        </div>

        {expanded && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Circuit Details
            </p>
            <Detail label="State" value={config.label} />
            <Detail
              label="Last Transition"
              value={formatDate(breaker.lastStateChangeAt)}
            />
            <Detail
              label="Next Probe"
              value={formatDate(breaker.nextProbeAt)}
            />
            <Detail
              label="Lease Owner"
              value={breaker.halfOpenLeaseOwner || "None"}
            />
            <Detail
              label="Lease Expiry"
              value={formatDate(breaker.halfOpenLeaseExpiresAt)}
            />
          </div>
        )}

        <div className="flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Details
          </Button>

          {canReset && (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              loading={resetting}
              disabled={resetting}
              onClick={() => onReset(breaker)}
            >
              {!resetting && <RefreshCw className="h-4 w-4" />}
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CircuitBreakerMonitor() {
  const { auth } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const merchantId = auth?.merchantId ?? null;

  const {
    data,
    isPending,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["circuit-breakers", merchantId],
    queryFn: () => apiClient.get("/api/v1/routing/circuit-breakers"),
    enabled: Boolean(auth),
    refetchInterval: 10000,
    staleTime: 5000,
    retry: 1,
  });

  const resetMutation = useMutation({
    mutationFn: (breaker) =>
      apiClient.post(
        `/api/v1/routing/circuit-breakers/${encodeURIComponent(
          breaker.providerId,
        )}/reset`,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["circuit-breakers", merchantId],
      });

      addToast({
        title: "Circuit breaker reset",
        description: "The latest circuit state has been requested.",
        variant: "success",
      });
    },
    onError: (mutationError) => {
      addToast({
        title: "Reset failed",
        description:
          mutationError?.message || "Unable to reset circuit breaker.",
        variant: "error",
      });
    },
  });

  const payload = data?.data;
  const breakers = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : [];

  const handleReset = (breaker) => {
    if (resetMutation.isPending) return;
    resetMutation.mutate(breaker);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Circuit Breaker Monitor
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Monitor provider circuit states, failures, and recovery.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              isFetching && "animate-spin",
            )}
          />
          Refresh
        </Button>
      </header>

      {!auth ? (
        <Alert>
          <AlertTitle>Authentication required</AlertTitle>
          <AlertDescription>
            Sign in or start a demo session to view circuit breakers.
          </AlertDescription>
        </Alert>
      ) : isPending ? (
        <div role="status" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-72 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load circuit breakers</AlertTitle>
          <AlertDescription>
            {error?.message || "Please try again."}
          </AlertDescription>
        </Alert>
      ) : breakers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Shield className="h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-base font-semibold">
              No circuit breakers configured
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Circuit breakers will appear when provider operations create them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {breakers.map((breaker) => (
            <CircuitBreakerCard
              key={`${breaker.providerId}-${breaker.operationType}`}
              breaker={breaker}
              onReset={handleReset}
              resetting={
                resetMutation.isPending &&
                resetMutation.variables?.providerId === breaker.providerId &&
                resetMutation.variables?.operationType === breaker.operationType
              }
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Circuit Breaker States
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {Object.entries(STATE_CONFIG).map(([state, config]) => {
            const Icon = config.icon;

            return (
              <div
                key={state}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className="h-4 w-4 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold">
                    {config.label}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {config.description}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default CircuitBreakerMonitor;

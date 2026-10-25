import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  XCircle,
  Zap,
  ShieldAlert,
  AlertTriangle,
  Play,
  RefreshCw,
  Server,
} from "lucide-react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { useToast } from "../../components/ui/Toast.jsx";
import { AuthGate } from "../../components/AuthGate.jsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Badge } from "../../components/ui/Badge.jsx";

const SCENARIOS = [
  {
    id: "alpha-timeout",
    name: "Provider Timeout",
    provider: "alpha",
    description: "Simulate delayed responses from provider Alpha.",
    icon: Clock3,
    rule: { type: "timeout", enabled: true, delayMs: 30000 },
  },
  {
    id: "beta-decline",
    name: "Provider Decline",
    provider: "beta",
    description: "Simulate declined operations from provider Beta.",
    icon: XCircle,
    rule: {
      type: "decline",
      enabled: true,
      code: "PROVIDER_DECLINED",
      message: "Simulated decline",
    },
  },
  {
    id: "gamma-latency",
    name: "High Latency",
    provider: "gamma",
    description: "Introduce processing delays for provider Gamma.",
    icon: Zap,
    rule: { type: "latency", enabled: true, delayMs: 5000 },
  },
  {
    id: "all-unavailable",
    name: "Provider Outage",
    provider: "all",
    description: "Simulate provider errors across the sandbox.",
    icon: ShieldAlert,
    rule: {
      type: "error",
      enabled: true,
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "Simulated provider outage",
    },
  },
];

function getFaults(response) {
  const data = response?.data?.data ?? response?.data ?? {};

  if (Array.isArray(data)) return { enabled: data.length > 0, rules: data };

  const faults = data.faults ?? data.active_faults ?? data;

  if (Array.isArray(faults)) {
    return { enabled: faults.length > 0, rules: faults };
  }

  return {
    enabled: Boolean(faults?.enabled),
    rules: Array.isArray(faults?.rules) ? faults.rules : [],
  };
}

function getProviders(response) {
  const data = response?.data?.data ?? response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.providers)) return data.providers;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export function ChaosLab() {
  const { auth } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState(null);
  const [actionError, setActionError] = useState("");

  const faultsQuery = useQuery({
    queryKey: ["sandbox-faults", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/sandbox/faults"),
    enabled: Boolean(auth),
    refetchInterval: 5000,
  });

  const providersQuery = useQuery({
    queryKey: ["providers", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/routing/providers"),
    enabled: Boolean(auth),
    refetchInterval: 10000,
  });

  const faults = getFaults(faultsQuery.data);
  const providers = getProviders(providersQuery.data);
  const activeRules = faults.rules.filter((rule) => rule.enabled !== false);
  const hasActiveFault = faults.enabled && activeRules.length > 0;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sandbox-faults"] }),
      queryClient.invalidateQueries({ queryKey: ["provider-faults"] }),
      queryClient.invalidateQueries({ queryKey: ["providers"] }),
      queryClient.invalidateQueries({ queryKey: ["circuit-breakers"] }),
    ]);
  };

  const mutation = useMutation({
    mutationFn: async (action) => {
      if (action === "clear") {
        return apiClient.delete("/api/v1/sandbox/faults");
      }

      const scenario = SCENARIOS.find((item) => item.id === action);

      if (!scenario) throw new Error("Invalid fault scenario.");

      return apiClient.post("/api/v1/sandbox/faults", {
        enabled: true,
        rules: [
          {
            ...scenario.rule,
            providerId: scenario.provider,
          },
        ],
      });
    },
    onSuccess: async (_, action) => {
      setActionError("");
      if (action === "clear") setSelectedId(null);
      else setSelectedId(action);

      await refresh();

      addToast({
        title: action === "clear" ? "Faults cleared" : "Fault injected",
        description:
          action === "clear"
            ? "Sandbox fault configuration has been cleared."
            : "The selected fault configuration was applied.",
        variant: "success",
        duration: 3000,
      });
    },
    onError: (error) => {
      setActionError(error?.message ?? "Unable to update sandbox faults.");
    },
  });

  if (!auth) {
    return (
      <AuthGate
        title="Chaos Engineering Lab"
        description="Inject synthetic provider failures and monitor system recovery."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Chaos Lab
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Inject controlled faults and observe provider reliability.
          </p>
        </div>

        <Badge
          variant={
            faultsQuery.isError
              ? "destructive"
              : hasActiveFault
                ? "warning"
                : "success"
          }
        >
          {faultsQuery.isError
            ? "Status Unavailable"
            : hasActiveFault
              ? "Fault Active"
              : "No Active Faults"}
        </Badge>
      </header>

      {(faultsQuery.isError || actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {actionError || faultsQuery.error?.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          const active = hasActiveFault && selectedId === scenario.id;

          return (
            <Card
              key={scenario.id}
              className={
                active ? "border-blue-500 ring-1 ring-blue-500/20" : ""
              }
            >
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  {active && <Badge variant="warning">Active</Badge>}
                </div>

                <h3 className="mt-4 text-sm font-semibold">{scenario.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                  {scenario.provider === "all"
                    ? "All Providers"
                    : `Provider ${scenario.provider}`}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {scenario.description}
                </p>

                <Button
                  className="mt-5 w-full"
                  variant="outline"
                  disabled={
                    mutation.isPending ||
                    faultsQuery.isPending ||
                    faultsQuery.isError ||
                    hasActiveFault
                  }
                  onClick={() => mutation.mutate(scenario.id)}
                >
                  <Play className="h-4 w-4" />
                  Inject Fault
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasActiveFault && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                Fault Injection Enabled
              </p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">
                {activeRules.map((rule) => rule.type).join(", ")}
              </p>
            </div>
          </div>

          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("clear")}
          >
            <XCircle className="h-4 w-4" />
            Clear All Faults
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Provider Circuit Breakers</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            disabled={providersQuery.isFetching}
            onClick={() => providersQuery.refetch()}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                providersQuery.isFetching ? "animate-spin" : ""
              }`}
            />
          </Button>
        </CardHeader>
        <CardContent>
          {providersQuery.isPending ? (
            <p className="text-sm text-slate-500">Loading providers...</p>
          ) : providersQuery.isError ? (
            <p role="alert" className="text-sm text-red-600">
              {providersQuery.error?.message}
            </p>
          ) : providers.length === 0 ? (
            <p className="text-sm text-slate-500">No providers configured.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {providers.map((provider) => {
                const state = provider.circuitBreaker?.state;

                return (
                  <div
                    key={provider.providerId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Server className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="truncate text-sm font-medium">
                        {provider.providerName ?? provider.providerId}
                      </span>
                    </div>
                    <Badge
                      variant={
                        state === "CLOSED"
                          ? "success"
                          : state === "OPEN"
                            ? "destructive"
                            : state === "HALF_OPEN"
                              ? "warning"
                              : "secondary"
                      }
                    >
                      {state?.replaceAll("_", " ") ?? "Unknown"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Failover Behavior</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Provider failures may trigger pre-dispatch failover. Operations
              with uncertain outcomes require reconciliation before further
              financial actions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recovery Safety</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Use provider operation identifiers, idempotency controls, and
              reconciliation to reduce the risk of duplicate financial effects
              during recovery.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ChaosLab;

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { cn } from "../../lib/utils.js";
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
import {
  Clock,
  XCircle,
  Zap,
  AlertTriangle,
  StopCircle,
  Play,
  ShieldAlert,
} from "lucide-react";

const FAULT_SCENARIOS = [
  {
    id: "alpha-timeout",
    name: "Alpha Provider Timeout",
    provider: "alpha",
    description:
      "Provider Alpha processes requests but responses are delayed beyond client timeout, simulating network partition.",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    faultType: "timeout",
    defaultDelayMs: 30000,
  },
  {
    id: "beta-decline",
    name: "Beta Provider Decline",
    provider: "beta",
    description:
      "Provider Beta explicitly rejects authorization and capture requests with a decline response.",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    faultType: "decline",
  },
  {
    id: "gamma-latency",
    name: "Gamma Provider Latency Spike",
    provider: "gamma",
    description:
      "Provider Gamma experiences elevated latency, slowing all operations without failing them outright.",
    icon: Zap,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    faultType: "latency",
    defaultDelayMs: 5000,
  },
  {
    id: "all-unavailable",
    name: "All Providers Unavailable",
    provider: "all",
    description:
      "All providers (Alpha, Beta, Gamma) are unavailable, demonstrating complete provider outage behavior.",
    icon: ShieldAlert,
    color: "text-red-600",
    bgColor: "bg-red-50",
    faultType: "error",
  },
];

export function ChaosLab() {
  const { auth } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [activeScenario, setActiveScenario] = useState(null);
  const [isInjecting, setIsInjecting] = useState(false);

  const { data: faultsData, isLoading: faultsLoading } = useQuery({
    queryKey: ["sandbox-faults"],
    queryFn: () => apiClient.sandbox.faults(),
    enabled: !!auth,
    refetchInterval: 3000,
  });

  const activeFaults =
    faultsData?.data?.active_faults || faultsData?.data?.faults || [];
  const hasActiveFault = activeFaults.length > 0;

  const setFaultsMutation = useMutation({
    mutationFn: (config) => apiClient.sandbox.setFaults(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sandbox-faults"] });
      addToast({
        title: "Fault configuration updated",
        variant: "success",
        description: "Chaos engineering fault has been applied to providers",
        duration: 4000,
      });
    },
    onError: (error) => {
      addToast({
        title: "Fault injection failed",
        variant: "error",
        description: error.message || "Unable to apply fault configuration",
        duration: 5000,
      });
    },
  });

  const clearFaultsMutation = useMutation({
    mutationFn: () => apiClient.sandbox.clearFaults(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sandbox-faults"] });
      setActiveScenario(null);
      addToast({
        title: "All faults cleared",
        variant: "success",
        description: "Provider fault injection has been removed",
        duration: 4000,
      });
    },
    onError: (error) => {
      addToast({
        title: "Clear faults failed",
        variant: "error",
        description: error.message || "Unable to clear fault configuration",
        duration: 5000,
      });
    },
  });

  const handleInject = (scenario) => {
    setActiveScenario(scenario);
    setIsInjecting(true);

    let config = {};
    if (scenario.faultType === "timeout") {
      config = {
        enabled: true,
        rules: [
          { type: "timeout", enabled: true, delayMs: scenario.defaultDelayMs },
        ],
      };
    } else if (scenario.faultType === "decline") {
      config = {
        enabled: true,
        rules: [{ type: "decline", enabled: true }],
      };
    } else if (scenario.faultType === "latency") {
      config = {
        enabled: true,
        rules: [
          { type: "latency", enabled: true, delayMs: scenario.defaultDelayMs },
        ],
      };
    } else if (scenario.faultType === "error") {
      config = {
        enabled: true,
        rules: [{ type: "error", enabled: true }],
      };
    }

    setTimeout(() => {
      setIsInjecting(false);
      setFaultsMutation.mutate(config);
    }, 500);
  };

  const handleClear = () => {
    setIsInjecting(true);
    setTimeout(() => {
      setIsInjecting(false);
      clearFaultsMutation.mutate();
    }, 500);
  };

  if (!auth) {
    return (
      <AuthGate
        title="Chaos Engineering Lab"
        description="Inject faults across providers to test timeout, decline, latency, and failover behavior in real time."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chaos Lab</h1>
          <p className="text-gray-500 mt-1">
            Inject faults into providers to observe routing failover, circuit
            breaker behavior, and recovery under failure.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={hasActiveFault ? "destructive" : "success"}>
            {hasActiveFault ? "ACTIVE FAULT" : "ALL SYSTEMS NOMINAL"}
          </Badge>
        </div>
      </div>

      {faultsLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-200 border-t-blue-600" />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {FAULT_SCENARIOS.map((scenario) => {
          const isActive = activeScenario?.id === scenario.id;
          return (
            <Card
              key={scenario.id}
              className={cn(
                "group border transition-all duration-200",
                isActive
                  ? "border-blue-500 shadow-sm ring-1 ring-blue-500/20"
                  : "border-slate-200 hover:border-slate-300",
                hasActiveFault && !isActive
                  ? "opacity-50 pointer-events-none"
                  : "",
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <scenario.icon className={`h-5 w-5 ${scenario.color}`} />
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                        {scenario.name}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {scenario.provider.toUpperCase()} provider
                    </p>
                  </div>
                  {isActive && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                      <span className="text-[10px] font-bold text-white">
                        ACTIVE
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  {scenario.description}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                {hasActiveFault && !isActive ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <span>Cannot inject while another fault is active</span>
                  </div>
                ) : (
                  <Button
                    variant={isActive ? "destructive" : "default"}
                    onClick={() => handleInject(scenario)}
                    disabled={isInjecting || hasActiveFault}
                    className="w-full"
                  >
                    {isInjecting ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span className="text-xs">Applying…</span>
                      </div>
                    ) : isActive ? (
                      <>
                        <StopCircle className="h-4 w-4 mr-2" />
                        Clear Fault
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Inject Fault
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasActiveFault && activeScenario && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex items-center gap-3 pb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-sm font-medium text-red-900">
              Active Chaos Scenario: {activeScenario.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-100/50">
                <span className="text-xs text-red-700 font-medium">
                  Provider Affected
                </span>
                <span className="text-xs font-mono text-red-700">
                  {activeScenario.provider.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-100/50">
                <span className="text-xs text-red-700 font-medium">
                  Fault Type
                </span>
                <span className="text-xs font-mono text-red-700">
                  {activeScenario.faultType}
                </span>
              </div>
              <Button
                variant="destructive"
                onClick={handleClear}
                disabled={isInjecting}
                className="w-full"
              >
                {isInjecting ? "Clearing…" : "Clear All Faults"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Circuit Breaker Response</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              When a provider exceeds failure thresholds, its circuit breaker
              opens and traffic is routed to healthy alternatives.
            </p>
            <div className="mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Alpha</span>
                <span className="text-gray-900 font-mono">CLOSED</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-500">Beta</span>
                <span className="text-gray-900 font-mono">CLOSED</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-500">Gamma</span>
                <span className="text-gray-900 font-mono">CLOSED</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Failover Behavior</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Pre-dispatch failover protects payments from known-unhealthy
              providers. Failed operations are reconciled against the original
              provider to prevent duplicate charges.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Safety Guarantees</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• No automatic reroute of unresolved operations</li>
              <li>• Capture/refunds target owning provider only</li>
              <li>• UNKNOWN outcomes trigger reconciliation</li>
              <li>• All routing decisions audited</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ChaosLab;

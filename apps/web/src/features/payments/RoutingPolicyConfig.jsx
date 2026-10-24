
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, RotateCcw, Pencil, RefreshCw } from "lucide-react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Input } from "../../components/ui/Input.jsx";
import { Label } from "../../components/ui/Label.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/Select.jsx";
import { Switch } from "../../components/ui/Switch.jsx";

const STRATEGIES = [
  ["RELIABILITY_FIRST", "Reliability First"],
  ["LOWEST_LATENCY", "Lowest Latency"],
  ["LOWEST_COST", "Lowest Cost"],
  ["BALANCED_ADAPTIVE", "Balanced Adaptive"],
];

const DEFAULT_POLICY = {
  strategy: "BALANCED_ADAPTIVE",
  allowedProviderIds: ["alpha", "beta", "gamma"],
  preferredProviderId: "",
  weights: { reliability: 50, latency: 30, cost: 20 },
  minimumHealthThreshold: 0.95,
  fallbackEnabled: true,
  circuitBreakerEnabled: true,
  stickinessEnabled: true,
};

function normalizePolicy(data) {
  const policy = data?.data?.data ?? data?.data ?? data;
  const value = Array.isArray(policy)
    ? policy.find((item) => item.scope === "global" || item.id === "global")
    : policy?.policy ?? policy?.global ?? policy;

  if (!value || typeof value !== "object") return null;

  return {
    ...DEFAULT_POLICY,
    ...value,
    preferredProviderId: value.preferredProviderId ?? "",
    allowedProviderIds: value.allowedProviderIds ?? DEFAULT_POLICY.allowedProviderIds,
    weights: { ...DEFAULT_POLICY.weights, ...value.weights },
  };
}

export function RoutingPolicyConfig() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [policy, setPolicy] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const query = useQuery({
    queryKey: ["routing-policies", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/routing/policies"),
    enabled: Boolean(auth),
  });

  const savedPolicy = normalizePolicy(query.data);

  const mutation = useMutation({
    mutationFn: (value) =>
      apiClient.put("/api/v1/routing/policies/global", value),
    onSuccess: async () => {
      setEditing(false);
      setPolicy(null);
      setSuccess("Routing policy saved successfully.");
      await queryClient.invalidateQueries({ queryKey: ["routing-policies"] });
    },
    onError: (err) => {
      setError(err?.message || "Unable to save routing policy.");
    },
  });

  const current = policy ?? savedPolicy ?? DEFAULT_POLICY;
  const totalWeight = Object.values(current.weights).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );

  const update = (key, value) => {
    setError("");
    setSuccess("");
    setPolicy((prev) => ({ ...(prev ?? current), [key]: value }));
  };

  const updateWeight = (key, value) => {
    update("weights", {
      ...current.weights,
      [key]: value === "" ? 0 : Number(value),
    });
  };

  const toggleProvider = (id, checked) => {
    update(
      "allowedProviderIds",
      checked
        ? [...current.allowedProviderIds, id]
        : current.allowedProviderIds.filter((provider) => provider !== id),
    );

    if (!checked && current.preferredProviderId === id) {
      setPolicy((prev) => ({
        ...prev,
        allowedProviderIds: prev.allowedProviderIds.filter((provider) => provider !== id),
        preferredProviderId: "",
      }));
    }
  };

  const reset = () => {
    setPolicy(savedPolicy);
    setEditing(false);
    setError("");
    setSuccess("");
  };

  const save = (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (totalWeight !== 100) {
      setError("Routing weights must total exactly 100.");
      return;
    }

    if (!current.allowedProviderIds.length) {
      setError("Select at least one allowed provider.");
      return;
    }

    if (
      current.preferredProviderId &&
      !current.allowedProviderIds.includes(current.preferredProviderId)
    ) {
      setError("Preferred provider must be an allowed provider.");
      return;
    }

    if (
      !Number.isFinite(Number(current.minimumHealthThreshold)) ||
      current.minimumHealthThreshold < 0 ||
      current.minimumHealthThreshold > 1
    ) {
      setError("Health threshold must be between 0 and 1.");
      return;
    }

    mutation.mutate({
      strategy: current.strategy,
      allowedProviderIds: current.allowedProviderIds,
      preferredProviderId: current.preferredProviderId || null,
      weights: current.weights,
      minimumHealthThreshold: Number(current.minimumHealthThreshold),
      fallbackEnabled: current.fallbackEnabled,
      circuitBreakerEnabled: current.circuitBreakerEnabled,
      stickinessEnabled: current.stickinessEnabled,
    });
  };

  const providers = [...new Set([
    ...DEFAULT_POLICY.allowedProviderIds,
    ...(savedPolicy?.allowedProviderIds ?? []),
  ])];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Routing Policy Configuration
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure provider selection, routing weights, and failover behavior.
          </p>
        </div>

        {!editing && (
          <Button
            disabled={!auth || query.isPending || query.isError}
            onClick={() => {
              setSuccess("");
              setPolicy(savedPolicy);
              setEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit Policy
          </Button>
        )}
      </header>

      {query.isPending && auth ? (
        <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ) : !auth || query.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            {!auth
              ? "Sign in to view routing policies."
              : query.error?.message ?? "Unable to load routing policy."}
          </CardContent>
        </Card>
      ) : !savedPolicy ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            No global routing policy was returned by the server.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Global Routing Policy</CardTitle>
            {!editing && (
              <span className="text-xs text-slate-500">Read-only</span>
            )}
          </CardHeader>

          <CardContent>
            <form onSubmit={save} className="space-y-7">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                >
                  {error}
                </div>
              )}

              {success && (
                <p role="status" className="text-sm font-medium text-emerald-600">
                  {success}
                </p>
              )}

              <div className="space-y-2">
                <Label>Routing Strategy</Label>
                <Select
                  disabled={!editing}
                  value={current.strategy}
                  onValueChange={(value) => update("strategy", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGIES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Allowed Providers</Label>
                <div className="flex flex-wrap gap-3">
                  {providers.map((id) => (
                    <label
                      key={id}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
                        current.allowedProviderIds.includes(id)
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!editing}
                        checked={current.allowedProviderIds.includes(id)}
                        onChange={(event) => toggleProvider(id, event.target.checked)}
                        className="h-4 w-4 accent-blue-600"
                      />
                      <span className="capitalize">{id}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preferred Provider</Label>
                <Select
                  disabled={!editing}
                  value={current.preferredProviderId || "NONE"}
                  onValueChange={(value) =>
                    update("preferredProviderId", value === "NONE" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No preference</SelectItem>
                    {current.allowedProviderIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 border-t border-slate-200 pt-6 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Routing Weights</h3>
                  <span
                    className={`text-sm font-semibold ${
                      totalWeight === 100 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {totalWeight} / 100
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {["reliability", "latency", "cost"].map((key) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`weight-${key}`} className="capitalize">
                        {key}
                      </Label>
                      <Input
                        id={`weight-${key}`}
                        type="number"
                        min="0"
                        max="100"
                        disabled={!editing}
                        value={current.weights[key]}
                        onChange={(event) => updateWeight(key, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5 border-t border-slate-200 pt-6 dark:border-slate-800">
                <h3 className="font-semibold">Advanced Settings</h3>

                <div className="flex items-center justify-between gap-5">
                  <div>
                    <Label htmlFor="health-threshold">Minimum Health Threshold</Label>
                    <p className="mt-1 text-xs text-slate-500">
                      Minimum provider availability required for routing.
                    </p>
                  </div>
                  <Input
                    id="health-threshold"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    className="w-24 shrink-0"
                    disabled={!editing}
                    value={current.minimumHealthThreshold}
                    onChange={(event) =>
                      update("minimumHealthThreshold", event.target.value)
                    }
                  />
                </div>

                {[
                  ["fallbackEnabled", "Fallback Enabled", "Allow alternative providers when routing fails."],
                  ["circuitBreakerEnabled", "Circuit Breaker", "Isolate providers experiencing repeated failures."],
                  ["stickinessEnabled", "Provider Stickiness", "Preserve provider binding for ongoing operations."],
                ].map(([key, label, description]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-5"
                  >
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="mt-1 text-xs text-slate-500">{description}</p>
                    </div>
                    <Switch
                      checked={Boolean(current[key])}
                      disabled={!editing}
                      onCheckedChange={(checked) => update(key, checked)}
                    />
                  </div>
                ))}
              </div>

              {editing && (
                <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={reset}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {mutation.isPending ? "Saving..." : "Save Policy"}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default RoutingPolicyConfig;

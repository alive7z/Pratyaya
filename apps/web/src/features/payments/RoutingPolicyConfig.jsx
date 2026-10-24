import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/Alert.jsx";
import { Loader2, Save, RotateCcw, AlertTriangle } from "lucide-react";

const STRATEGIES = [
  {
    value: "RELIABILITY_FIRST",
    label: "Reliability First",
    description: "Prefer providers with highest measured reliability",
  },
  {
    value: "LOWEST_LATENCY",
    label: "Lowest Latency",
    description: "Prefer providers with lowest processing latency",
  },
  {
    value: "LOWEST_COST",
    label: "Lowest Cost",
    description: "Prefer providers with lowest transaction cost",
  },
  {
    value: "BALANCED_ADAPTIVE",
    label: "Balanced Adaptive",
    description: "Weighted scoring across reliability, latency, and cost",
  },
];

const PROVIDERS = [
  { id: "alpha", name: "Alpha" },
  { id: "beta", name: "Beta" },
  { id: "gamma", name: "Gamma" },
];

export function RoutingPolicyConfig() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [policy, setPolicy] = useState({
    strategy: "BALANCED_ADAPTIVE",
    allowedProviderIds: ["alpha", "beta", "gamma"],
    preferredProviderId: "",
    weights: { reliability: 50, latency: 30, cost: 20 },
    minimumHealthThreshold: 0.95,
    fallbackEnabled: true,
    circuitBreakerEnabled: true,
    stickinessEnabled: true,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [, setSaveStatus] = useState("idle");
  const [validationErrors, setValidationErrors] = useState({});

  const { isLoading } = useQuery({
    queryKey: ["routing-policies"],
    queryFn: () => apiClient.get("/api/v1/routing/policies"),
    enabled: !!auth,
  });

  const saveMutation = useMutation({
    mutationFn: (policyData) =>
      apiClient.put("/api/v1/routing/policies/global", policyData, {
        headers: { "Content-Type": "application/json" },
      }),
    onMutate: () => {
      setSaveStatus("saving");
      setValidationErrors({});
    },
    onSuccess: () => {
      setSaveStatus("saved");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["routing-policies"] });
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: (error) => {
      setSaveStatus("error");
      if (error.details?.issues) {
        const errors = {};
        error.details.issues.forEach((issue) => {
          errors[issue.path.join(".")] = issue.message;
        });
        setValidationErrors(errors);
      }
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    const totalWeight =
      policy.weights.reliability + policy.weights.latency + policy.weights.cost;
    if (totalWeight !== 100) {
      setValidationErrors({ weights: "Weights must sum to 100" });
      return;
    }
    if (policy.allowedProviderIds.length === 0) {
      setValidationErrors({
        allowedProviderIds: "At least one provider must be allowed",
      });
      return;
    }
    saveMutation.mutate(policy);
  };

  const handleReset = () => {
    queryClient.invalidateQueries({ queryKey: ["routing-policies"] });
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="h-8 bg-gray-200 animate-pulse rounded w-1/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Routing Policy Configuration
          </h1>
          <p className="text-gray-500 mt-1">
            Configure how payments are routed across providers
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Edit Policy
          </Button>
        )}
      </div>

      {validationErrors.weights && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validation Error</AlertTitle>
          <AlertDescription>{validationErrors.weights}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Global Routing Policy</CardTitle>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <span>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <span>
                        <Save className="h-4 w-4 mr-2" />
                        Save Policy
                      </span>
                    )}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isEditing && (
            <Alert variant="default" className="mb-4">
              <AlertTitle>Current Policy (Read-Only)</AlertTitle>
              <AlertDescription>
                Click "Edit Policy" to modify routing configuration. Changes
                affect all new payment routing decisions.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <Label className="block text-sm font-medium mb-2">
                Routing Strategy
              </Label>
              <Select
                value={policy.strategy}
                onValueChange={(value) =>
                  setPolicy({ ...policy, strategy: value })
                }
                disabled={!isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-sm text-gray-500">
                {
                  STRATEGIES.find((s) => s.value === policy.strategy)
                    ?.description
                }
              </p>
            </div>

            <div>
              <Label className="block text-sm font-medium mb-2">
                Allowed Providers
              </Label>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      policy.allowedProviderIds.includes(p.id)
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-700 hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={policy.allowedProviderIds.includes(p.id)}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          allowedProviderIds: e.target.checked
                            ? [...policy.allowedProviderIds, p.id]
                            : policy.allowedProviderIds.filter(
                                (id) => id !== p.id,
                              ),
                        })
                      }
                      disabled={!isEditing}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    />
                    <span className="capitalize">{p.name}</span>
                  </label>
                ))}
              </div>
              {policy.allowedProviderIds.length === 0 && isEditing && (
                <p className="mt-1 text-sm text-red-600">
                  At least one provider must be allowed
                </p>
              )}
            </div>

            <div>
              <Label className="block text-sm font-medium mb-2">
                Preferred Provider (Optional)
              </Label>
              <Select
                value={policy.preferredProviderId}
                onValueChange={(value) =>
                  setPolicy({ ...policy, preferredProviderId: value })
                }
                disabled={!isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No preference</SelectItem>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-6">
              <Label className="block text-sm font-medium mb-4">
                Routing Weights (must sum to 100)
              </Label>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="reliability">Reliability Weight</Label>
                  <Input
                    id="reliability"
                    type="number"
                    min="0"
                    max="100"
                    value={policy.weights.reliability}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        weights: {
                          ...policy.weights,
                          reliability: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="latency">Latency Weight</Label>
                  <Input
                    id="latency"
                    type="number"
                    min="0"
                    max="100"
                    value={policy.weights.latency}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        weights: {
                          ...policy.weights,
                          latency: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Cost Weight</Label>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    max="100"
                    value={policy.weights.cost}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        weights: {
                          ...policy.weights,
                          cost: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className={`text-sm font-medium ${policy.weights.reliability + policy.weights.latency + policy.weights.cost === 100 ? "text-green-600" : "text-red-600"}`}
                >
                  Total:{" "}
                  {policy.weights.reliability +
                    policy.weights.latency +
                    policy.weights.cost}{" "}
                  / 100
                </span>
                {isEditing &&
                  policy.weights.reliability +
                    policy.weights.latency +
                    policy.weights.cost !==
                    100 && (
                    <span className="text-sm text-red-600">Must equal 100</span>
                  )}
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-medium">Advanced Settings</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Minimum Health Threshold</Label>
                    <p className="text-sm text-gray-500">
                      Providers below this availability threshold are excluded
                    </p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={policy.minimumHealthThreshold}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        minimumHealthThreshold: parseFloat(e.target.value),
                      })
                    }
                    disabled={!isEditing}
                    className="w-24"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Fallback Enabled</Label>
                    <p className="text-sm text-gray-500">
                      Allow routing to alternative providers when preferred
                      fails
                    </p>
                  </div>
                  <Switch
                    checked={policy.fallbackEnabled}
                    onCheckedChange={(checked) =>
                      setPolicy({ ...policy, fallbackEnabled: checked })
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Circuit Breaker Enabled</Label>
                    <p className="text-sm text-gray-500">
                      Enable automatic provider isolation on repeated failures
                    </p>
                  </div>
                  <Switch
                    checked={policy.circuitBreakerEnabled}
                    onCheckedChange={(checked) =>
                      setPolicy({ ...policy, circuitBreakerEnabled: checked })
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Provider Stickiness</Label>
                    <p className="text-sm text-gray-500">
                      Preserve provider binding for operations already in
                      progress
                    </p>
                  </div>
                  <Switch
                    checked={policy.stickinessEnabled}
                    onCheckedChange={(checked) =>
                      setPolicy({ ...policy, stickinessEnabled: checked })
                    }
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleReset}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Policy
                    </>
                  )}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery, useState } from "react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/Select.jsx";
import { Input } from "../../components/ui/Input.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Loader2, Search, Filter, Eye, AlertTriangle } from "lucide-react";

const STRATEGY_LABELS = {
  RELIABILITY_FIRST: "Reliability First",
  LOWEST_LATENCY: "Lowest Latency",
  LOWEST_COST: "Lowest Cost",
  BALANCED_ADAPTIVE: "Balanced Adaptive",
};

const REASON_VARIANTS = {
  PROVIDER_SELECTED: "success",
  NO_ELIGIBLE_PROVIDER: "destructive",
  CIRCUIT_BREAKER_OPEN: "destructive",
  PROVIDER_UNAVAILABLE: "destructive",
  FAILOVER: "default",
  MANUAL_OVERRIDE: "default",
};

export function RoutingDecisionExplorer() {
  const { auth } = useAuth();
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [filters, setFilters] = useState({
    providerId: "",
    strategy: "",
    reason: "",
    from: "",
    to: "",
    limit: 50,
  });

  const {
    data: decisionsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["routing-decisions", auth?.merchantId, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      return apiClient.get(`/api/v1/routing/decisions?${params.toString()}`);
    },
    enabled: !!auth,
  });

  const decisions = decisionsData?.data?.items || [];

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      providerId: "",
      strategy: "",
      reason: "",
      from: "",
      to: "",
      limit: 50,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="h-8 bg-gray-200 animate-pulse rounded w-1/4" />
            <div className="space-y-4 mt-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 animate-pulse rounded"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reasons = [...new Set(decisions.map((d) => d.decisionReason))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Routing Decision Explorer
          </h1>
          <p className="text-gray-500 mt-1">
            Inspect and analyze provider routing decisions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={clearFilters}
            disabled={!Object.values(filters).some(Boolean)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
          <Button onClick={() => refetch()}>
            <Loader2 className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Routing Decisions ({decisions.length})</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Filter by payment ID..."
                  value={filters.paymentId || ""}
                  onChange={(e) =>
                    handleFilterChange("paymentId", e.target.value)
                  }
                  className="w-64"
                />
              </div>
              <Select
                value={filters.providerId}
                onValueChange={(v) => handleFilterChange("providerId", v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Providers</SelectItem>
                  {["alpha", "beta", "gamma"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.strategy}
                onValueChange={(v) => handleFilterChange("strategy", v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Strategies</SelectItem>
                  {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.reason}
                onValueChange={(v) => handleFilterChange("reason", v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Reasons</SelectItem>
                  {reasons.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r
                        .replace(/_/g, " ")
                        .toLowerCase()
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <>
            {decisions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  No routing decisions found matching the current filters
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="pb-3 font-medium w-40">Decision ID</th>
                      <th className="pb-3 font-medium w-36">Payment</th>
                      <th className="pb-3 font-medium w-24">Provider</th>
                      <th className="pb-3 font-medium w-36">Strategy</th>
                      <th className="pb-3 font-medium w-36">Reason</th>
                      <th className="pb-3 font-medium w-40">Created</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {decisions.map((decision) => (
                      <tr
                        key={decision.decisionId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedDecision(decision)}
                      >
                        <td className="py-3 text-sm font-mono text-gray-600">
                          {decision.decisionId.slice(-16)}
                        </td>
                        <td className="py-3 text-sm font-mono text-gray-600">
                          {decision.paymentId?.slice(-12)}
                        </td>
                        <td className="py-3">
                          <Badge variant="default" className="capitalize">
                            {decision.selectedProviderId || "—"}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm">
                          <Badge variant="default">
                            {STRATEGY_LABELS[decision.routingStrategy] ||
                              decision.routingStrategy}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              REASON_VARIANTS[decision.decisionReason] ||
                              "secondary"
                            }
                          >
                            {decision.decisionReason.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm text-gray-500">
                          {new Date(decision.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDecision(decision);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        </CardContent>
      </Card>

      {selectedDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Routing Decision Details</h2>
                <p className="text-sm text-gray-500">
                  {selectedDecision.decisionId}
                </p>
              </div>
              <button
                onClick={() => setSelectedDecision(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Decision ID
                  </p>
                  <p className="font-mono text-sm">
                    {selectedDecision.decisionId}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Payment
                  </p>
                  <p className="font-mono text-sm">
                    {selectedDecision.paymentId}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Operation
                  </p>
                  <p className="capitalize text-sm">
                    {selectedDecision.operationType?.toLowerCase()}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Selected Provider
                  </p>
                  <p className="text-2xl font-bold capitalize">
                    {selectedDecision.selectedProviderId || "None"}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Strategy
                  </p>
                  <p className="text-lg font-medium">
                    {STRATEGY_LABELS[selectedDecision.routingStrategy] ||
                      selectedDecision.routingStrategy}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Reason
                  </p>
                  <Badge
                    variant={
                      REASON_VARIANTS[selectedDecision.decisionReason] ||
                      "secondary"
                    }
                    className="text-lg"
                  >
                    {selectedDecision.decisionReason.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Scoring Breakdown</h3>
                {selectedDecision.scoreBreakdown?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-left text-sm text-gray-500">
                          <th className="pb-2 font-medium">Provider</th>
                          <th className="pb-2 font-medium text-right">
                            Reliability
                          </th>
                          <th className="pb-2 font-medium text-right">
                            Latency
                          </th>
                          <th className="pb-2 font-medium text-right">Cost</th>
                          <th className="pb-2 font-medium text-right">
                            Weighted
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedDecision.scoreBreakdown.map((score) => (
                          <tr
                            key={score.providerId}
                            className="hover:bg-gray-50"
                          >
                            <td className="py-2 text-sm capitalize">
                              {score.providerId}
                            </td>
                            <td className="py-2 text-sm text-right">
                              {(score.reliabilityScore * 100).toFixed(1)}%
                            </td>
                            <td className="py-2 text-sm text-right">
                              {(score.latencyScore * 100).toFixed(1)}%
                            </td>
                            <td className="py-2 text-sm text-right">
                              {(score.costScore * 100).toFixed(1)}%
                            </td>
                            <td className="py-2 text-sm font-medium text-right text-blue-600">
                              {(score.weightedScore * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">
                    No scoring breakdown available
                  </p>
                )}
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">
                  Eligible & Rejected Providers
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      Eligible Providers
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedDecision.eligibleProviders?.map((p) => (
                        <Badge key={p} variant="success" className="capitalize">
                          {p}
                        </Badge>
                      ))}
                      {!selectedDecision.eligibleProviders?.length && (
                        <span className="text-sm text-gray-500">None</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      Rejected Providers
                    </h4>
                    <div className="space-y-1">
                      {selectedDecision.rejectedProviders?.map((r) => (
                        <Badge
                          key={r.providerId}
                          variant="destructive"
                          className="w-full justify-start gap-2"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {r.providerId}: {r.reason}
                        </Badge>
                      ))}
                      {!selectedDecision.rejectedProviders?.length && (
                        <span className="text-sm text-gray-500">None</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Payment Details</h3>
                <div className="grid gap-4 md:grid-cols-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Amount
                    </p>
                    <p className="font-medium">
                      ${(Number(selectedDecision.amountMinor) / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Currency
                    </p>
                    <p className="font-medium">{selectedDecision.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Timestamp
                    </p>
                    <p className="font-medium">
                      {new Date(selectedDecision.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setSelectedDecision(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

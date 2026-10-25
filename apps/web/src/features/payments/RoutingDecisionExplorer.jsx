import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, RefreshCw, FilterX, Eye, AlertTriangle } from "lucide-react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { formatMoney } from "../../lib/format.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Input } from "../../components/ui/Input.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/Select.jsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/Dialog.jsx";

const STRATEGIES = {
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
  FAILOVER: "warning",
  MANUAL_OVERRIDE: "info",
};

const INITIAL_FILTERS = {
  providerId: "ALL",
  strategy: "ALL",
  reason: "ALL",
  paymentId: "",
};

function getItems(response) {
  const data = response?.data?.data ?? response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.decisions)) return data.decisions;
  return [];
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatScore(value) {
  return value == null || !Number.isFinite(Number(value))
    ? "—"
    : `${(Number(value) * 100).toFixed(1)}%`;
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 break-all text-sm font-semibold">
        {children ?? "—"}
      </div>
    </div>
  );
}

function DecisionDetails({ decision, onClose }) {
  const scores = decision.scoreBreakdown ?? [];

  return (
    <Dialog
      open={Boolean(decision)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Routing Decision Details</DialogTitle>
          <DialogDescription className="break-all">
            {decision.decisionId ?? decision.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Detail label="Payment ID">{decision.paymentId}</Detail>
            <Detail label="Selected Provider">
              {decision.selectedProviderId ?? "None"}
            </Detail>
            <Detail label="Operation">{decision.operationType}</Detail>
            <Detail label="Strategy">
              {STRATEGIES[decision.routingStrategy] ?? decision.routingStrategy}
            </Detail>
            <Detail label="Decision Reason">
              <Badge
                variant={
                  REASON_VARIANTS[decision.decisionReason] ?? "secondary"
                }
              >
                {decision.decisionReason?.replaceAll("_", " ") ?? "Unknown"}
              </Badge>
            </Detail>
            <Detail label="Created">{formatDate(decision.createdAt)}</Detail>
          </div>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Scoring Breakdown</h3>
            {scores.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                    <tr>
                      {[
                        "Provider",
                        "Reliability",
                        "Latency",
                        "Cost",
                        "Weighted",
                      ].map((label) => (
                        <th key={label} className="px-3 py-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((score) => (
                      <tr
                        key={score.providerId}
                        className="border-b border-slate-100 dark:border-slate-800"
                      >
                        <td className="px-3 py-3 font-medium">
                          {score.providerId}
                        </td>
                        <td className="px-3 py-3">
                          {formatScore(score.reliabilityScore)}
                        </td>
                        <td className="px-3 py-3">
                          {formatScore(score.latencyScore)}
                        </td>
                        <td className="px-3 py-3">
                          {formatScore(score.costScore)}
                        </td>
                        <td className="px-3 py-3 font-semibold text-blue-600">
                          {formatScore(score.weightedScore)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No scoring data available.
              </p>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold">Eligible Providers</h3>
              <div className="flex flex-wrap gap-2">
                {decision.eligibleProviders?.length ? (
                  decision.eligibleProviders.map((provider) => (
                    <Badge key={provider} variant="success">
                      {provider}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">None</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Rejected Providers</h3>
              <div className="space-y-2">
                {decision.rejectedProviders?.length ? (
                  decision.rejectedProviders.map((provider) => (
                    <p
                      key={provider.providerId}
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      {provider.providerId}: {provider.reason}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">None</p>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Amount">
              {decision.amountMinor != null && decision.currency
                ? formatMoney(decision.amountMinor, decision.currency)
                : "—"}
            </Detail>
            <Detail label="Currency">{decision.currency}</Detail>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RoutingDecisionExplorer() {
  const { auth } = useAuth();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selectedDecision, setSelectedDecision] = useState(null);

  const { data, isPending, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["routing-decisions", auth?.merchantId, "explorer"],
    queryFn: () => apiClient.get("/api/v1/routing/decisions?limit=100"),
    enabled: Boolean(auth),
    refetchInterval: 30000,
  });

  const decisions = getItems(data);

  const providers = [
    ...new Set(
      decisions.map((item) => item.selectedProviderId).filter(Boolean),
    ),
  ];

  const reasons = [
    ...new Set(decisions.map((item) => item.decisionReason).filter(Boolean)),
  ];

  const filtered = decisions.filter((decision) => {
    const paymentMatch =
      !filters.paymentId.trim() ||
      String(decision.paymentId ?? "")
        .toLowerCase()
        .includes(filters.paymentId.trim().toLowerCase());

    return (
      paymentMatch &&
      (filters.providerId === "ALL" ||
        decision.selectedProviderId === filters.providerId) &&
      (filters.strategy === "ALL" ||
        decision.routingStrategy === filters.strategy) &&
      (filters.reason === "ALL" || decision.decisionReason === filters.reason)
    );
  });

  const updateFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== INITIAL_FILTERS[key],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Routing Decision Explorer
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Inspect provider selection, routing strategies, and decision
            details.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!hasFilters}
            onClick={() => setFilters(INITIAL_FILTERS)}
          >
            <FilterX className="h-4 w-4" />
            Clear
          </Button>
          <Button
            variant="outline"
            disabled={!auth || isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Routing Decisions ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                aria-label="Filter payment ID"
                value={filters.paymentId}
                onChange={(event) =>
                  updateFilter("paymentId", event.target.value)
                }
                placeholder="Search payment ID"
                className="pl-9"
              />
            </div>

            <Select
              value={filters.providerId}
              onValueChange={(value) => updateFilter("providerId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Providers</SelectItem>
                {providers.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.strategy}
              onValueChange={(value) => updateFilter("strategy", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Strategies</SelectItem>
                {Object.entries(STRATEGIES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.reason}
              onValueChange={(value) => updateFilter("reason", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Reasons</SelectItem>
                {reasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!auth ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Sign in to view routing decisions.
            </p>
          ) : isPending ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : isError ? (
            <p role="alert" className="py-6 text-center text-sm text-red-600">
              {error?.message ?? "Unable to load routing decisions."}
            </p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <AlertTriangle className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">
                {hasFilters
                  ? "No decisions match your filters."
                  : "No routing decisions recorded yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                  <tr>
                    {[
                      "Decision ID",
                      "Payment",
                      "Provider",
                      "Strategy",
                      "Reason",
                      "Created",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-3 py-3 font-medium"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((decision, index) => (
                    <tr
                      key={decision.decisionId ?? decision.id ?? index}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <td className="px-3 py-3 font-mono text-xs">
                        {String(
                          decision.decisionId ?? decision.id ?? "—",
                        ).slice(-16)}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {String(decision.paymentId ?? "—").slice(-12)}
                      </td>
                      <td className="px-3 py-3">
                        {decision.selectedProviderId ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {STRATEGIES[decision.routingStrategy] ??
                          decision.routingStrategy ??
                          "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={
                            REASON_VARIANTS[decision.decisionReason] ??
                            "secondary"
                          }
                        >
                          {decision.decisionReason?.replaceAll("_", " ") ??
                            "Unknown"}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                        {formatDate(decision.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="View decision details"
                          onClick={() => setSelectedDecision(decision)}
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
        </CardContent>
      </Card>

      {selectedDecision && (
        <DecisionDetails
          decision={selectedDecision}
          onClose={() => setSelectedDecision(null)}
        />
      )}
    </div>
  );
}

export default RoutingDecisionExplorer;

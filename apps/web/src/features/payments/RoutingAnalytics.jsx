
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  PieChart as PieIcon,
  Activity,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
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

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

const REASON_VARIANTS = {
  PROVIDER_SELECTED: "success",
  NO_ELIGIBLE_PROVIDER: "destructive",
  CIRCUIT_BREAKER_OPEN: "destructive",
  PROVIDER_UNAVAILABLE: "destructive",
  FAILOVER: "warning",
  MANUAL_OVERRIDE: "info",
};

function getItems(response, key) {
  const data = response?.data?.data ?? response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

function countBy(items, field) {
  return Object.entries(
    items.reduce((result, item) => {
      const key = item[field] || "Unknown";
      result[key] = (result[key] ?? 0) + 1;
      return result;
    }, {}),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function Metric({ title, value, icon: Icon }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 pt-5">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <Icon
          className="h-5 w-5 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children, empty }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">
            No data available
          </div>
        ) : (
          <div className="h-72 w-full min-w-0">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RoutingAnalytics() {
  const { auth } = useAuth();
  const merchantId = auth?.merchantId ?? auth?.merchant?.id;

  const decisionsQuery = useQuery({
    queryKey: ["routing-decisions", merchantId],
    queryFn: () => apiClient.get("/api/v1/routing/decisions?limit=100"),
    enabled: Boolean(auth),
    refetchInterval: 30000,
  });

  const providersQuery = useQuery({
    queryKey: ["routing-providers", merchantId],
    queryFn: () => apiClient.get("/api/v1/routing/providers"),
    enabled: Boolean(auth),
    refetchInterval: 30000,
  });

  const decisions = getItems(decisionsQuery.data, "decisions");
  const providers = getItems(providersQuery.data, "providers");

  const routingDistribution = useMemo(
    () =>
      countBy(
        decisions.filter((decision) => decision.selectedProviderId),
        "selectedProviderId",
      ),
    [decisions],
  );

  const strategyUsage = useMemo(
    () => countBy(decisions, "routingStrategy"),
    [decisions],
  );

  const decisionReasons = useMemo(
    () => countBy(decisions, "decisionReason"),
    [decisions],
  );

  const providerLatency = useMemo(
    () =>
      providers
        .map((provider) => ({
          name: provider.providerName ?? provider.providerId,
          p50: provider.healthMetrics?.latencyP50Ms ?? null,
          p95: provider.healthMetrics?.latencyP95Ms ?? null,
        }))
        .filter((provider) => provider.p50 != null || provider.p95 != null),
    [providers],
  );

  const loading = decisionsQuery.isPending || providersQuery.isPending;
  const fetching = decisionsQuery.isFetching || providersQuery.isFetching;
  const error = decisionsQuery.error || providersQuery.error;

  const metrics = [
    ["Recent Decisions", decisions.length, BarChart3],
    ["Providers Selected", routingDistribution.length, PieIcon],
    ["Strategies Used", strategyUsage.length, Activity],
    [
      "Failed Selections",
      decisions.filter(
        (decision) => decision.decisionReason === "NO_ELIGIBLE_PROVIDER",
      ).length,
      AlertTriangle,
    ],
  ];

  const refresh = () => {
    decisionsQuery.refetch();
    providersQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Routing Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Analyze recent routing decisions, provider selection, and latency.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={!auth || fetching}
          onClick={refresh}
        >
          <RefreshCw
            className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </header>

      {!auth ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Sign in or start a demo session to view routing analytics.
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {error.message ?? "Unable to load routing analytics."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(([title, value, Icon]) => (
              <Metric
                key={title}
                title={title}
                value={value}
                icon={Icon}
              />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Routing Distribution by Provider"
              empty={!routingDistribution.length}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={routingDistribution}
                  margin={{ top: 10, right: 10, left: -15, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#cbd5e1"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Decisions"
                    fill="#2563eb"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Routing Strategy Usage"
              empty={!strategyUsage.length}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={strategyUsage}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {strategyUsage.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Provider Latency Comparison (ms)"
              empty={!providerLatency.length}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={providerLatency}
                  margin={{ top: 10, right: 10, left: -15, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#cbd5e1"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    unit="ms"
                  />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="p50"
                    name="P50 Latency"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="p95"
                    name="P95 Latency"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Decision Reasons
                </CardTitle>
              </CardHeader>
              <CardContent>
                {decisionReasons.length ? (
                  <div className="max-h-72 space-y-3 overflow-y-auto">
                    {decisionReasons.map(({ name, count }) => (
                      <div
                        key={name}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              REASON_VARIANTS[name] ?? "secondary"
                            }
                          >
                            {name.replaceAll("_", " ")}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {count} decisions
                          </span>
                        </div>
                        <span className="text-sm font-semibold">
                          {((count / decisions.length) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-slate-500">
                    No routing decisions recorded.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Analytics are based on up to 100 recent routing decisions.
            Provider latency values represent reported snapshots, not
            historical trends.
          </p>
        </>
      )}
    </div>
  );
}

export default RoutingAnalytics;

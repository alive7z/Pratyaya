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
import {
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

function getReasonVariant(reason) {
  const variants = {
    PROVIDER_SELECTED: "success",
    NO_ELIGIBLE_PROVIDER: "destructive",
    CIRCUIT_BREAKER_OPEN: "destructive",
    PROVIDER_UNAVAILABLE: "destructive",
    FAILOVER: "default",
    MANUAL_OVERRIDE: "default",
  };
  return variants[reason] || "secondary";
}

export function RoutingAnalytics() {
  const { auth } = useAuth();

  const { data: decisionsData, isLoading: decisionsLoading } = useQuery({
    queryKey: ["routing-decisions", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/routing/decisions?limit=100"),
    enabled: !!auth,
  });

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => apiClient.get("/api/v1/routing/providers"),
    enabled: !!auth,
  });

  const loading = decisionsLoading || providersLoading;

  const decisions = decisionsData?.data?.items || [];
  const providers = providersData?.data || [];

  const providerStats = {};
  decisions.forEach((d) => {
    if (!providerStats[d.selectedProviderId]) {
      providerStats[d.selectedProviderId] = { count: 0, strategies: {} };
    }
    providerStats[d.selectedProviderId].count++;
    providerStats[d.selectedProviderId].strategies[d.routingStrategy] =
      (providerStats[d.selectedProviderId].strategies[d.routingStrategy] || 0) +
      1;
  });

  const routingDistribution = Object.entries(providerStats).map(
    ([providerId, stats]) => ({
      providerId,
      count: stats.count,
      strategies: stats.strategies,
    }),
  );

  const strategyUsage = {};
  decisions.forEach((d) => {
    strategyUsage[d.routingStrategy] =
      (strategyUsage[d.routingStrategy] || 0) + 1;
  });

  const decisionReasons = {};
  decisions.forEach((d) => {
    decisionReasons[d.decisionReason] =
      (decisionReasons[d.decisionReason] || 0) + 1;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="h-8 bg-gray-200 animate-pulse rounded w-1/4" />
            <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2 mt-2" />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="h-64 bg-gray-50" />
          </Card>
          <Card>
            <CardContent className="h-64 bg-gray-50" />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Routing Analytics
          </h1>
          <p className="text-gray-500 mt-1">
            Provider routing decisions and performance metrics
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Decisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                {decisions.length}
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Unique Providers Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                {Object.keys(providerStats).length}
              </div>
              <PieChartIcon className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Strategies Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                {Object.keys(strategyUsage).length}
              </div>
              <LineChartIcon className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Failed Selections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                {
                  decisions.filter(
                    (d) => d.decisionReason === "NO_ELIGIBLE_PROVIDER",
                  ).length
                }
              </div>
              <TrendingDown className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Routing Distribution by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={
                  routingDistribution.length > 0
                    ? routingDistribution
                    : [{ providerId: "none", count: 0 }]
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="providerId" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#374151" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  <Cell fill="#3b82f6" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {routingDistribution.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No routing decisions yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategy Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(strategyUsage).map(([name, value]) => ({
                    name,
                    value,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#8b5cf6" />
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {Object.keys(strategyUsage).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No strategy data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Decision Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(decisionReasons).map(([reason, count]) => (
                <div
                  key={reason}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={getReasonVariant(reason)}>{reason}</Badge>
                    <span className="text-sm text-gray-600">
                      {count} decisions
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {((count / decisions.length) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
              {Object.keys(decisionReasons).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No decision data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Provider Latency Trends</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={providers.map((p) => ({
                  name: p.providerId,
                  latency: p.healthMetrics?.latencyP50Ms ?? 0,
                  p95: p.healthMetrics?.latencyP95Ms ?? 0,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="P50 Latency"
                />
                <Line
                  type="monotone"
                  dataKey="p95"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="P95 Latency"
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

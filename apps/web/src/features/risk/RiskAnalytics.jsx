import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { PieChart } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Cell,
  Pie,
  Legend,
} from "recharts";

export function RiskAnalytics() {
  const { auth } = useAuth();

  const { data: decisionsData, isLoading: decisionsLoading } = useQuery({
    queryKey: ["risk-decisions", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/risk/decisions?limit=200"),
    enabled: !!auth,
    refetchInterval: 30000,
  });

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ["risk-rules"],
    queryFn: () => apiClient.get("/api/v1/risk/rules"),
    enabled: !!auth,
    refetchInterval: 60000,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["risk-summary", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/risk/summary"),
    enabled: !!auth,
    refetchInterval: 30000,
  });

  const loading = decisionsLoading || rulesLoading || summaryLoading;

  const decisions = decisionsData?.data?.items || [];
  const rules = rulesData?.data?.rules || [];
  const summary = summaryData?.data;

  const decisionCounts = decisions.reduce((acc, d) => {
    acc[d.decision] = (acc[d.decision] || 0) + 1;
    return acc;
  }, {});

  const levelCounts = decisions.reduce((acc, d) => {
    acc[d.level] = (acc[d.level] || 0) + 1;
    return acc;
  }, {});

  const ruleTypeCounts = rules.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const scoreDistribution = decisions.reduce((acc, d) => {
    const bucket = Math.floor(d.score / 10) * 10;
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                <div className="h-8 bg-gray-200 animate-pulse rounded w-full mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

  const totalDecisions = summary?.total || decisions.length;
  const totalRules = rules.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Analytics</h1>
          <p className="text-gray-500 mt-1">
            Real-time fraud detection and risk scoring analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <svg
              className="h-4 w-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 00-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
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
            <div className="text-3xl font-bold text-gray-900">
              {totalDecisions}
            </div>
            <p className="text-xs text-gray-500">Risk decisions processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Active Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalRules}</div>
            <p className="text-xs text-gray-500">Risk rules configured</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Block Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {totalDecisions > 0
                ? (
                    ((decisionCounts.BLOCK || 0) / totalDecisions) *
                    100
                  ).toFixed(1) + "%"
                : "0%"}
            </div>
            <p className="text-xs text-gray-500">
              Payments blocked by risk engine
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Review Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {totalDecisions > 0
                ? (
                    ((decisionCounts.REVIEW || 0) / totalDecisions) *
                    100
                  ).toFixed(1) + "%"
                : "0%"}
            </div>
            <p className="text-xs text-gray-500">Payments sent for review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Decision Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart
                data={Object.entries(decisionCounts).map(([name, value]) => ({
                  name,
                  value,
                }))}
              >
                <Pie
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
                  <Cell fill="#22c55e" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            {Object.keys(decisionCounts).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No decision data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Level Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.entries(levelCounts).map(([name, value]) => ({
                  name,
                  value,
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
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  <Cell fill="#22c55e" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#f97316" />
                  <Cell fill="#ef4444" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {Object.keys(levelCounts).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No risk level data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Risk Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.entries(scoreDistribution).map(
                  ([name, value]) => ({
                    name: `${name}-${Number(name) + 9}`,
                    value,
                  }),
                )}
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
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
            {Object.keys(scoreDistribution).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No score data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Rules by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                if (Object.entries(ruleTypeCounts).length > 0) {
                  return Object.entries(ruleTypeCounts).map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                          {type}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {count} rules
                      </span>
                    </div>
                  ));
                }
                return (
                  <div className="text-center py-8 text-gray-500">
                    No active rules configured
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rule Actions Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const actionCounts = rules.reduce((acc, r) => {
                  acc[r.action] = (acc[r.action] || 0) + 1;
                  return acc;
                }, {});
                if (Object.keys(actionCounts).length > 0) {
                  return Object.entries(actionCounts).map(([action, count]) => (
                    <div
                      key={action}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${action === "BLOCK" ? "bg-red-100 text-red-700" : action === "REVIEW" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}
                        >
                          {action}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {count} rules
                      </span>
                    </div>
                  ));
                }
                return (
                  <div className="text-center py-8 text-gray-500">
                    No active rules configured
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-gray-500">
                  <th className="pb-3 font-medium">Rule Code</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Action</th>
                  <th className="pb-3 font-medium">Severity</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rules.map((rule) => (
                  <tr key={rule.ruleCode} className="border-b hover:bg-gray-50">
                    <td className="py-3 text-sm font-mono text-gray-600">
                      {rule.ruleCode}
                    </td>
                    <td className="py-3 text-sm font-medium">{rule.name}</td>
                    <td className="py-3 text-sm">
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium capitalize">
                        {rule.type.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-3 text-sm">
                      {rule.action === "BLOCK" && (
                        <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          Block
                        </span>
                      )}
                      {rule.action === "REVIEW" && (
                        <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                          Review
                        </span>
                      )}
                      {rule.action === "ALLOW" && (
                        <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          Allow
                        </span>
                      )}
                      {rule.action === "SCORE_INCREMENT" && (
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                          Score +
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-sm">
                      {rule.severity === "CRITICAL" && (
                        <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          Critical
                        </span>
                      )}
                      {rule.severity === "HIGH" && (
                        <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                          High
                        </span>
                      )}
                      {rule.severity === "MEDIUM" && (
                        <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                          Medium
                        </span>
                      )}
                      {rule.severity === "LOW" && (
                        <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          Low
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-sm font-medium text-blue-600">
                      +{rule.scoreIncrement}
                    </td>
                    <td className="py-3 text-sm text-gray-500">
                      {rule.priority}
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No active rules configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RiskAnalytics;

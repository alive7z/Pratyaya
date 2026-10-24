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
import { Button } from "../../components/ui/Button.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/Select.jsx";
import { Input } from "../../components/ui/Input.jsx";
import { Loader2, Search, Eye, Shield, X } from "lucide-react";

const SEVERITY_COLORS = {
  LOW: { bg: "bg-green-100", text: "text-green-700", badge: "success" },
  MEDIUM: { bg: "bg-yellow-100", text: "text-yellow-700", badge: "default" },
  HIGH: { bg: "bg-orange-100", text: "text-orange-700", badge: "default" },
  CRITICAL: { bg: "bg-red-100", text: "text-red-700", badge: "destructive" },
};

export function TransactionReview() {
  const { auth } = useAuth();
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [filters, setFilters] = useState({
    severity: "",
    status: "",
    ruleCode: "",
    from: "",
    to: "",
    limit: 50,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["risk-alerts", auth?.merchantId, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      return apiClient.get(`/api/v1/risk/alerts?${params.toString()}`);
    },
    enabled: !!auth,
  });

  const { data: decisionsData } = useQuery({
    queryKey: ["risk-decisions", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/risk/decisions?limit=100"),
    enabled: !!auth,
  });

  const alerts = alertsData?.data?.items || [];
  const decisions = decisionsData?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Transaction Review
          </h1>
          <p className="text-gray-500 mt-1">
            Review and investigate flagged transactions
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <Loader2 className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle>Risk Alerts ({alerts.length})</CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Filter by payment ID..."
                    value={filters.paymentId || ""}
                    onChange={(e) =>
                      setFilters({ ...filters, paymentId: e.target.value })
                    }
                    className="w-64"
                  />
                </div>
                <Select
                  value={filters.severity}
                  onValueChange={(v) => setFilters({ ...filters, severity: v })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Severities</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.status}
                  onValueChange={(v) => setFilters({ ...filters, status: v })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_REVIEW">In Review</SelectItem>
                    <SelectItem value="ESCALATED">Escalated</SelectItem>
                    <SelectItem value="CLEARED">Cleared</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.ruleCode}
                  onValueChange={(v) => setFilters({ ...filters, ruleCode: v })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Rule Code" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Rules</SelectItem>
                    <SelectItem value="VELOCITY">Velocity</SelectItem>
                    <SelectItem value="AMOUNT_ANOMALY">
                      Amount Anomaly
                    </SelectItem>
                    <SelectItem value="FAILED_ATTEMPTS">
                      Failed Attempts
                    </SelectItem>
                    <SelectItem value="PATTERN">Pattern</SelectItem>
                    <SelectItem value="GEOGRAPHIC">Geographic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  No risk alerts found
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  All transactions appear normal, or try adjusting your filters
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="pb-3 font-medium w-40">Alert ID</th>
                      <th className="pb-3 font-medium w-36">Payment</th>
                      <th className="pb-3 font-medium w-24">Severity</th>
                      <th className="pb-3 font-medium w-28">Status</th>
                      <th className="pb-3 font-medium w-36">Rule</th>
                      <th className="pb-3 font-medium w-36">Score</th>
                      <th className="pb-3 font-medium w-40">Created</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {alerts.map((alert) => (
                      <tr
                        key={alert.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        <td className="py-3 text-sm font-mono text-gray-600">
                          {alert.id.slice(-12)}
                        </td>
                        <td className="py-3 text-sm font-mono text-gray-600">
                          {alert.paymentId?.slice(-12) || "—"}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              SEVERITY_COLORS[alert.severity]?.badge ||
                              "secondary"
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              alert.status === "OPEN"
                                ? "default"
                                : alert.status === "IN_REVIEW"
                                  ? "default"
                                  : alert.status === "ESCALATED"
                                    ? "destructive"
                                    : "success"
                            }
                          >
                            {alert.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm font-mono text-gray-600 max-w-xs truncate">
                          {alert.ruleCode}
                        </td>
                        <td className="py-3 text-sm font-medium">
                          {alert.score}
                        </td>
                        <td className="py-3 text-sm text-gray-500">
                          {new Date(alert.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAlert(alert);
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
          </CardContent>
        </Card>

        {selectedAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Alert Details</h2>
                  <p className="text-sm text-gray-500">{selectedAlert.id}</p>
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Alert ID
                    </p>
                    <p className="font-mono text-sm">{selectedAlert.id}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Payment
                    </p>
                    <p className="font-mono text-sm">
                      {selectedAlert.paymentId?.slice(-12) || "—"}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Reference
                    </p>
                    <p className="font-mono text-sm">
                      {selectedAlert.reference || "—"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Severity
                    </p>
                    <Badge
                      variant={
                        SEVERITY_COLORS[selectedAlert.severity]?.badge ||
                        "secondary"
                      }
                      className="text-lg mt-1"
                    >
                      {selectedAlert.severity}
                    </Badge>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Status
                    </p>
                    <Badge
                      variant={
                        selectedAlert.status === "OPEN"
                          ? "default"
                          : selectedAlert.status === "IN_REVIEW"
                            ? "default"
                            : selectedAlert.status === "ESCALATED"
                              ? "destructive"
                              : "success"
                      }
                      className="mt-1"
                    >
                      {selectedAlert.status}
                    </Badge>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Score
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {selectedAlert.score}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Rule Details</h3>
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Rule Code
                    </p>
                    <p className="font-mono text-sm">
                      {selectedAlert.ruleCode}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 mt-4">
                    <div className="p-4 rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Summary
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedAlert.summary}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Explanation
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedAlert.explanation}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Risk Decision</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Decision
                      </p>
                      <Badge
                        variant={
                          decisions.find(
                            (d) => d.paymentId === selectedAlert.paymentId,
                          )?.decision === "BLOCK"
                            ? "destructive"
                            : decisions.find(
                                  (d) =>
                                    d.paymentId === selectedAlert.paymentId,
                                )?.decision === "REVIEW"
                              ? "default"
                              : "success"
                        }
                        className="text-lg mt-1"
                      >
                        {decisions.find(
                          (d) => d.paymentId === selectedAlert.paymentId,
                        )?.decision || "UNKNOWN"}
                      </Badge>
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Score
                      </p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {decisions.find(
                          (d) => d.paymentId === selectedAlert.paymentId,
                        )?.score || "—"}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Level
                      </p>
                      <Badge
                        variant={
                          SEVERITY_COLORS[
                            decisions.find(
                              (d) => d.paymentId === selectedAlert.paymentId,
                            )?.level
                          ]?.badge || "secondary"
                        }
                        className="mt-1"
                      >
                        {decisions.find(
                          (d) => d.paymentId === selectedAlert.paymentId,
                        )?.level || "—"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedAlert(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}

export default TransactionReview;

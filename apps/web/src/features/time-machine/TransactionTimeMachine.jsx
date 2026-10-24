import { useState } from "react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { formatMoney } from "../../lib/format.js";
import { AuthGate } from "../../components/AuthGate.jsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Input } from "../../components/ui/Input.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/Select.jsx";
import { Clock, Activity, Search, RefreshCw } from "lucide-react";

const STATUS_VARIANTS = {
  CREATED: "secondary",
  QUEUED: "secondary",
  AUTHORIZING: "default",
  AUTHORIZED: "default",
  CAPTURING: "default",
  CAPTURED: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
  UNKNOWN: "destructive",
  REFUND_PENDING: "default",
  PARTIALLY_REFUNDED: "default",
  REFUNDED: "success",
};

export function TransactionTimeMachine() {
  const { auth } = useAuth();
  const [paymentId, setPaymentId] = useState("");
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTimeline = async (id) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.payments.timeline(id);
      const timeline = data.data?.events || data.events || [];
      setTimelineData({
        payment: data.data?.payment || data.payment,
        events: timeline,
      });
    } catch (err) {
      setError(err.message || "Failed to load payment timeline");
      setTimelineData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = (e) => {
    e.preventDefault();
    if (!paymentId.trim()) return;
    fetchTimeline(paymentId.trim());
  };

  const statusColor = (status) => {
    const colors = {
      CREATED: "text-gray-500",
      QUEUED: "text-yellow-500",
      AUTHORIZING: "text-blue-500",
      AUTHORIZED: "text-green-600",
      CAPTURING: "text-blue-500",
      CAPTURED: "text-green-600",
      FAILED: "text-red-600",
      CANCELLED: "text-gray-500",
      UNKNOWN: "text-yellow-600",
      REFUND_PENDING: "text-yellow-500",
      PARTIALLY_REFUNDED: "text-yellow-500",
      REFUNDED: "text-green-600",
    };
    return colors[status] || "text-gray-500";
  };

  if (!auth) {
    return (
      <AuthGate
        title="Transaction Time Machine"
        description="Inspect state transitions and timeline replay for any payment across providers."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Transaction Time Machine
          </h1>
          <p className="text-gray-500 mt-1">
            Replay payment state transitions and inspect the full lifecycle of
            any payment through your system.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lookup Payment Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium mb-2">
                  Payment ID
                </label>
                <Input
                  placeholder="e.g., pay_abc123def456"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Replaying…</span>
                  </div>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Replay Timeline
                  </>
                )}
              </Button>
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {timelineData && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-sm text-gray-600">
                  {timelineData.payment?.reference || "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {formatMoney(
                    timelineData.payment?.amountMinor,
                    timelineData.payment?.currency,
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Currency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium text-gray-900 capitalize">
                  {timelineData.payment?.currency || "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Current Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    STATUS_VARIANTS[timelineData.payment?.status] ?? "secondary"
                  }
                >
                  {timelineData.payment?.status}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>State Transition Timeline</CardTitle>
              <div className="flex items-center gap-2">
                <Select value="all" onValueChange={() => {}}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="state_change">State Changes</SelectItem>
                    <SelectItem value="provider">
                      Provider Operations
                    </SelectItem>
                    <SelectItem value="ledger">Ledger Events</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                {timelineData.events?.map((event, index) => (
                  <div key={event.id || index} className="relative pl-12 pb-6">
                    <div className="absolute left-0 top-2.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-white" />
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-medium text-xs">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">
                            {event.summary || event.eventType}
                          </h4>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(event.toStatus || event.fromStatus)}`}
                          >
                            {event.toStatus || event.fromStatus || "—"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {event.eventType.replace(/_/g, " ").toLowerCase()}
                          {event.actorRole ? ` • ${event.actorRole}` : ""}
                        </p>
                        <div className="mt-1 text-xs text-gray-400">
                          {new Date(event.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {timelineData.events?.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="h-8 w-8 mx-auto text-gray-300 mb-3" />
                    <p>No timeline events recorded for this payment</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase">
                    Status Reason
                  </p>
                  <p className="text-sm">
                    {timelineData.payment?.statusReason || "—"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase">Created At</p>
                  <p className="text-sm">
                    {timelineData.payment?.createdAt
                      ? new Date(
                          timelineData.payment.createdAt,
                        ).toLocaleString()
                      : "—"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase">Risk Score</p>
                  <p className="text-sm font-mono">
                    {timelineData.payment?.riskScore ?? "—"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase">Created By</p>
                  <p className="text-sm">
                    {timelineData.payment?.createdByUserId
                      ? timelineData.payment.createdByUserId
                          .toString()
                          .slice(-8)
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!timelineData && !loading && !error && (
        <div className="text-center py-20">
          <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            Enter a Payment ID
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Look up any payment to replay its full state transition history,
            from creation through authorization, capture, and refund.
          </p>
        </div>
      )}
    </div>
  );
}

export default TransactionTimeMachine;

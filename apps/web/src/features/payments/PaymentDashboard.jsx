import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { formatMoney } from "../../lib/format.js";
import { useToast } from "../../components/ui/Toast.jsx";
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
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

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

export function PaymentDashboard() {
  const { auth } = useAuth();
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["payment-summary", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/payments/summary"),
    enabled: !!auth,
  });

  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "payments",
      auth?.merchantId,
      { limit: 50, search, status: statusFilter },
    ],
    queryFn: () => apiClient.get("/api/v1/payments?limit=50"),
    enabled: !!auth,
  });

  const loading = summaryLoading || paymentsLoading;

  const rawPayments = Array.isArray(paymentsData?.data)
    ? paymentsData.data
    : paymentsData?.data?.payments || paymentsData?.data?.items || [];

  const payments = rawPayments.filter((payment) => {
    const matchesSearch =
      search === "" ||
      payment.reference?.toLowerCase().includes(search.toLowerCase()) ||
      payment.customerReference?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "" || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = summary?.data?.statusCounts || {};
  const totalAuthorized = statusCounts.AUTHORIZED || 0;
  const totalCaptured = statusCounts.CAPTURED || 0;
  const totalFailed = statusCounts.FAILED || 0;
  const totalUnknown = statusCounts.UNKNOWN || 0;
  const totalPending =
    (statusCounts.QUEUED || 0) +
    (statusCounts.AUTHORIZING || 0) +
    (statusCounts.CAPTURING || 0);

  const handleRefresh = async () => {
    try {
      await refetch();
      addToast({
        title: "Payments refreshed",
        variant: "success",
        description: "Payment data updated from the server",
        duration: 3000,
      });
    } catch {
      addToast({
        title: "Refresh failed",
        variant: "error",
        description: "Unable to refresh payment data",
        duration: 4000,
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Payment Operations
            </h1>
            <p className="text-gray-500 mt-1">
              Overview of payment processing and financial status
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                <div className="h-8 bg-gray-200 animate-pulse rounded w-full mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Payment Operations
          </h1>
          <p className="text-gray-500 mt-1">
            Overview of payment processing and financial status
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Authorized Payments
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-50">
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAuthorized}</div>
            <p className="text-xs text-gray-500">Payments awaiting capture</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Captured Payments
            </CardTitle>
            <div className="p-2 rounded-lg bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCaptured}</div>
            <p className="text-xs text-gray-500">Successfully captured funds</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Failed Payments
            </CardTitle>
            <div className="p-2 rounded-lg bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFailed}</div>
            <p className="text-xs text-gray-500">Declined or errored</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Unknown Status
            </CardTitle>
            <div className="p-2 rounded-lg bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnknown}</div>
            <p className="text-xs text-gray-500">Requires reconciliation</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending Processing
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPending}</div>
            <p className="text-xs text-gray-500">Payments in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Payments
            </CardTitle>
            <div className="p-2 rounded-lg bg-gray-50">
              <CreditCard className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.data?.total || 0}
            </div>
            <p className="text-xs text-gray-500">All time payment count</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <CardTitle>Recent Payments</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Filter by reference or status to find specific payments
            </p>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex items-center w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <Input
                placeholder="Search by reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="CREATED">Created</SelectItem>
                <SelectItem value="QUEUED">Queued</SelectItem>
                <SelectItem value="AUTHORIZED">Authorized</SelectItem>
                <SelectItem value="CAPTURED">Captured</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="UNKNOWN">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium w-40">Reference</th>
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium w-24">Amount</th>
                  <th className="pb-3 font-medium w-20">Currency</th>
                  <th className="pb-3 font-medium w-20">Status</th>
                  <th className="pb-3 font-medium w-40">Created</th>
                  <th className="pb-3 font-medium w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No payments found matching your filters
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 group">
                      <td className="py-3 font-mono text-gray-600">
                        {payment.reference}
                      </td>
                      <td className="py-3 text-sm">
                        {payment.customerReference || "—"}
                      </td>
                      <td className="py-3 text-sm font-medium">
                        {formatMoney(payment.amountMinor, payment.currency)}
                      </td>
                      <td className="py-3 text-sm">{payment.currency}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            STATUS_VARIANTS[payment.status] ?? "secondary"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            to={`/payments/${payment.id}`}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PaymentDashboard;

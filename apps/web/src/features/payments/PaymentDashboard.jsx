import { useQuery } from "@tanstack/react-query";
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
import {
  CreditCard,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

export function PaymentDashboard() {
  const { auth } = useAuth();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["payment-summary", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/payments/summary"),
    enabled: !!auth,
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments", auth?.merchantId, { limit: 10 }],
    queryFn: () => apiClient.get("/api/v1/payments?limit=10"),
    enabled: !!auth,
  });

  const { data: ledgerBalances, isLoading: ledgerLoading } = useQuery({
    queryKey: ["ledger-balances", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/ledger/balances?currency=USD"),
    enabled: !!auth,
  });

  const loading = summaryLoading || paymentsLoading || ledgerLoading;

  if (loading) {
    return (
      <div className="space-y-6">
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

  const totalAuthorized = summary?.data?.statusCounts?.AUTHORIZED || 0;
  const totalCaptured = summary?.data?.statusCounts?.CAPTURED || 0;
  const totalFailed = summary?.data?.statusCounts?.FAILED || 0;
  const totalUnknown = summary?.data?.statusCounts?.UNKNOWN || 0;
  const totalPending =
    (summary?.data?.statusCounts?.QUEUED || 0) +
    (summary?.data?.statusCounts?.AUTHORIZING || 0) +
    (summary?.data?.statusCounts?.CAPTURING || 0);

  const capturedAmount =
    ledgerBalances?.data?.find((b) => b.accountCode === "MERCHANT_PAYABLE")
      ?.balanceMinor || "0";
  const providerClearing =
    ledgerBalances?.data?.find((b) => b.accountCode === "PROVIDER_CLEARING")
      ?.balanceMinor || "0";

  const stats = [
    {
      title: "Authorized Payments",
      value: totalAuthorized,
      icon: CreditCard,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Captured Payments",
      value: totalCaptured,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Failed Payments",
      value: totalFailed,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Unknown Status",
      value: totalUnknown,
      icon: AlertTriangle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
  ];

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
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
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
              Merchant Payable
            </CardTitle>
            <div className="p-2 rounded-lg bg-green-50">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(capturedAmount, "USD")}
            </div>
            <p className="text-xs text-gray-500">Confirmed captured funds</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Provider Clearing
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-50">
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(providerClearing, "USD")}
            </div>
            <p className="text-xs text-gray-500">Receivable from provider</p>
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
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-gray-500">
                  <th className="pb-3 font-medium">Reference</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Currency</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments?.data?.payments?.slice(0, 10).map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="py-3 font-mono text-sm">
                      {payment.reference}
                    </td>
                    <td className="py-3 text-sm">
                      {formatMoney(payment.amountMinor, payment.currency)}
                    </td>
                    <td className="py-3 text-sm">{payment.currency}</td>
                    <td className="py-3">
                      <Badge variant={getStatusVariant(payment.status)}>
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-sm text-gray-500">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!payments?.data?.payments?.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No payments found
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

function getStatusVariant(status) {
  const variants = {
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
  return variants[status] || "secondary";
}

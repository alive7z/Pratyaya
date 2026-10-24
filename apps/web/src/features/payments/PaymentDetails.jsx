import { useParams } from "react-router-dom";
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
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  ArrowDown,
  ArrowUp,
  RefreshCw,
} from "lucide-react";

const STATUS_STEPS = [
  { key: "CREATED", label: "Payment Created", icon: CreditCard },
  { key: "QUEUED", label: "Queued for Processing", icon: Clock },
  { key: "AUTHORIZING", label: "Authorizing", icon: RefreshCw },
  { key: "AUTHORIZED", label: "Authorized", icon: CheckCircle },
  { key: "CAPTURING", label: "Capturing", icon: RefreshCw },
  { key: "CAPTURED", label: "Captured", icon: DollarSign },
  { key: "REFUND_PENDING", label: "Refund Pending", icon: ArrowDown },
  { key: "PARTIALLY_REFUNDED", label: "Partially Refunded", icon: ArrowDown },
  { key: "REFUNDED", label: "Refunded", icon: ArrowUp },
  { key: "FAILED", label: "Failed", icon: XCircle },
  { key: "CANCELLED", label: "Cancelled", icon: XCircle },
  { key: "UNKNOWN", label: "Unknown", icon: AlertTriangle },
];

export function PaymentDetails() {
  const { paymentId } = useParams();
  const { auth } = useAuth();

  const { data: paymentData, isLoading: paymentLoading } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${paymentId}`),
    enabled: !!auth && !!paymentId,
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["payment-timeline", paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${paymentId}/timeline`),
    enabled: !!auth && !!paymentId,
  });

  const { data: attemptsData, isLoading: attemptsLoading } = useQuery({
    queryKey: ["payment-attempts", paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${paymentId}/attempts`),
    enabled: !!auth && !!paymentId,
  });

  const loading = paymentLoading || timelineLoading || attemptsLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="h-8 bg-gray-200 animate-pulse rounded w-1/4" />
            <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2 mt-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const payment = paymentData?.data?.payment;
  const timeline = timelineData?.data?.events || [];
  const attempts = attemptsData?.data?.attempts || [];

  if (!payment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Payment not found</p>
      </div>
    );
  }

  const currentStatusIndex = STATUS_STEPS.findIndex(
    (s) => s.key === payment.status,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {payment.reference}
          </h1>
          <p className="text-gray-500 mt-1">Payment Details & Timeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(payment.status)} className="text-sm">
            {payment.status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(payment.amountMinor, payment.currency)}
            </div>
            <p className="text-xs text-gray-500">{payment.currency}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Captured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(payment.capturedMinor, payment.currency)}
            </div>
            <p className="text-xs text-gray-500">Confirmed captured</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Refunded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(payment.refundedMinor, payment.currency)}
            </div>
            <p className="text-xs text-gray-500">Total refunded</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Available to Refund
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(
                BigInt(payment.capturedMinor) - BigInt(payment.refundedMinor),
                payment.currency,
              )}
            </div>
            <p className="text-xs text-gray-500">Captured - Refunded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {payment.customerLabel || "N/A"}
            </div>
            <p className="text-xs text-gray-500">
              {payment.customerReference || "No reference"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date(payment.createdAt).toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">Payment created</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Status Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {payment.statusReason || "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
            {STATUS_STEPS.map((step, index) => {
              const event = timeline.find(
                (e) => e.toStatus === step.key || e.fromStatus === step.key,
              );
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isFuture = index > currentStatusIndex;

              return (
                <div key={step.key} className="relative pl-12 pb-6 last:pb-0">
                  <div
                    className={cn(
                      "absolute left-6 top-0 w-3 h-3 rounded-full border-2 transition-all",
                      isCompleted
                        ? "bg-green-500 border-green-500"
                        : "bg-white border-gray-300",
                      isCurrent && "ring-4 ring-green-500/20",
                    )}
                  />
                  <div className="ml-2">
                    <div
                      className={cn(
                        "font-medium text-sm",
                        isCompleted ? "text-gray-900" : "text-gray-400",
                      )}
                    >
                      {step.label}
                    </div>
                    {event && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(event.createdAt).toLocaleString()} •{" "}
                        {event.actorRole || "system"}
                        {event.summary && (
                          <span className="ml-2">— {event.summary}</span>
                        )}
                      </div>
                    )}
                    {isFuture && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Pending
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Attempt</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">State</th>
                    <th className="pb-3 font-medium">Provider Op ID</th>
                    <th className="pb-3 font-medium">Latency</th>
                    <th className="pb-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attempts.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-gray-50">
                      <td className="py-3 text-sm">{attempt.attemptNumber}</td>
                      <td className="py-3 text-sm">{attempt.operationType}</td>
                      <td className="py-3">
                        <Badge
                          variant={getAttemptVariant(attempt.currentState)}
                        >
                          {attempt.currentState}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm font-mono text-xs">
                        {attempt.providerOperationId || "—"}
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {attempt.latencyMs ? `${attempt.latencyMs}ms` : "—"}
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {new Date(attempt.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
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

function getAttemptVariant(state) {
  const variants = {
    PENDING: "secondary",
    IN_FLIGHT: "default",
    SUCCEEDED: "success",
    FAILED: "destructive",
    CANCELLED: "secondary",
    UNKNOWN: "destructive",
    MANUAL_REVIEW: "default",
  };
  return variants[state] || "secondary";
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}

import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  ReceiptText,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { formatMoney } from "../../lib/format.js";
import { cn } from "../../lib/utils.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";

const STATUS_VARIANTS = {
  CREATED: "secondary",
  QUEUED: "warning",
  AUTHORIZING: "info",
  AUTHORIZED: "info",
  CAPTURING: "info",
  CAPTURED: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
  UNKNOWN: "warning",
  REFUND_PENDING: "warning",
  PARTIALLY_REFUNDED: "info",
  REFUNDED: "success",
};

const ATTEMPT_VARIANTS = {
  PENDING: "secondary",
  IN_FLIGHT: "info",
  SUCCEEDED: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
  UNKNOWN: "warning",
  MANUAL_REVIEW: "warning",
};

function getPayload(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function getItems(response, key) {
  const payload = getPayload(response);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function money(value, currency) {
  if (value == null) return "—";

  try {
    return formatMoney(String(value), currency);
  } catch {
    return "—";
  }
}

function availableToRefund(payment) {
  try {
    const captured = BigInt(payment.capturedMinor ?? 0);
    const refunded = BigInt(payment.refundedMinor ?? 0);
    const available = captured - refunded;

    return available > 0n ? available.toString() : "0";
  } catch {
    return null;
  }
}

function Status({ value, variants = STATUS_VARIANTS }) {
  return (
    <Badge variant={variants[value] ?? "secondary"}>
      {value?.replaceAll("_", " ") ?? "UNKNOWN"}
    </Badge>
  );
}

function Metric({ title, value, description, icon: Icon }) {
  return (
    <Card>
      <CardContent className="pt-5 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <Icon
            className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
        </div>
        <p className="mt-3 wrap-break-word text-xl font-bold tracking-tight text-slate-950 dark:text-white">
          {value}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 wrap-break-word text-sm font-medium text-slate-900 dark:text-white">
        {value ?? "—"}
      </dd>
    </div>
  );
}

function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading payment details"
      className="space-y-5"
    >
      <div className="h-12 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <AlertTriangle className="h-9 w-9 text-red-500" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold">Unable to load payment</h2>
        <p
          role="alert"
          className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400"
        >
          {error?.message ?? "The payment could not be retrieved."}
        </p>
        <div className="mt-5 flex gap-3">
          <Button onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Link to="/payments" className="btn-secondary">
            Back to Payments
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentTimeline({ events, isLoading, error, onRetry }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Transaction Timeline</CardTitle>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Recorded payment state transitions and events.
        </p>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
        ) : error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 text-sm text-red-600"
          >
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : events.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No timeline events recorded.
          </p>
        ) : (
          <ol className="relative ml-2 border-l border-slate-200 dark:border-slate-800">
            {events.map((event, index) => {
              const status =
                event.toStatus ?? event.status ?? event.eventType ?? "EVENT";

              const Icon =
                status === "FAILED" || status === "CANCELLED"
                  ? XCircle
                  : status === "UNKNOWN"
                    ? AlertTriangle
                    : status === "CAPTURED" || status === "REFUNDED"
                      ? CheckCircle2
                      : Clock3;

              return (
                <li
                  key={event.id ?? `${status}-${index}`}
                  className="relative ml-6 pb-6 last:pb-0"
                >
                  <span className="absolute -left-8.5 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
                    <Icon className="h-3 w-3" aria-hidden="true" />
                  </span>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {String(status).replaceAll("_", " ")}
                    </p>
                    <time className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(event.createdAt ?? event.timestamp)}
                    </time>
                  </div>

                  {event.fromStatus && event.toStatus && (
                    <p className="mt-1 text-xs text-slate-500">
                      {event.fromStatus} → {event.toStatus}
                    </p>
                  )}

                  {event.summary && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {event.summary}
                    </p>
                  )}

                  {event.actorRole && (
                    <p className="mt-1 text-xs text-slate-500">
                      Actor: {event.actorRole}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentAttempts({ attempts, isLoading, error, onRetry }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Payment Attempts</CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
        ) : error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 text-sm text-red-600"
          >
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : attempts.length === 0 ? (
          <p className="py-5 text-center text-sm text-slate-500">
            No provider attempts recorded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  {[
                    "Attempt",
                    "Operation",
                    "State",
                    "Provider Reference",
                    "Latency",
                    "Created",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="whitespace-nowrap px-3 py-3 font-semibold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attempts.map((attempt, index) => (
                  <tr
                    key={attempt.id ?? index}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <td className="px-3 py-3">
                      {attempt.attemptNumber ?? index + 1}
                    </td>
                    <td className="px-3 py-3">
                      {attempt.operationType ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Status
                        value={attempt.currentState}
                        variants={ATTEMPT_VARIANTS}
                      />
                    </td>
                    <td className="max-w-48 break-all px-3 py-3 font-mono text-xs">
                      {attempt.providerOperationId ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {attempt.latencyMs != null
                        ? `${attempt.latencyMs} ms`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                      {formatDate(attempt.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PaymentDetails() {
  const { paymentId } = useParams();
  const { auth } = useAuth();

  const merchantId = auth?.merchantId ?? null;
  const enabled = Boolean(auth && paymentId);
  const encodedId = encodeURIComponent(paymentId ?? "");

  const paymentQuery = useQuery({
    queryKey: ["payment", merchantId, paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${encodedId}`),
    enabled,
    staleTime: 5000,
  });

  const timelineQuery = useQuery({
    queryKey: ["payment-timeline", merchantId, paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${encodedId}/timeline`),
    enabled,
    staleTime: 5000,
  });

  const attemptsQuery = useQuery({
    queryKey: ["payment-attempts", merchantId, paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${encodedId}/attempts`),
    enabled,
    staleTime: 5000,
  });

  const refreshAll = () => {
    paymentQuery.refetch();
    timelineQuery.refetch();
    attemptsQuery.refetch();
  };

  if (!auth) {
    return (
      <ErrorState
        error={{
          message: "Sign in or start a demo session to view this payment.",
        }}
        onRetry={() => window.location.assign("/login")}
      />
    );
  }

  if (paymentQuery.isPending) return <Loading />;

  if (paymentQuery.isError) {
    return (
      <ErrorState
        error={paymentQuery.error}
        onRetry={() => paymentQuery.refetch()}
      />
    );
  }

  const payload = getPayload(paymentQuery.data);
  const payment = payload?.payment ?? payload;

  if (!payment || typeof payment !== "object") {
    return (
      <ErrorState
        error={{ message: "Payment not found." }}
        onRetry={() => paymentQuery.refetch()}
      />
    );
  }

  const timeline = getItems(timelineQuery.data, "events");
  const attempts = getItems(attemptsQuery.data, "attempts");

  const refundable = availableToRefund(payment);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Link
              to="/payments"
              aria-label="Back to payments"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="break-all text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {payment.reference ?? payment.id ?? paymentId}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Payment Details
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Status value={payment.status} />

          <Button
            variant="outline"
            size="sm"
            disabled={
              paymentQuery.isFetching ||
              timelineQuery.isFetching ||
              attemptsQuery.isFetching
            }
            onClick={refreshAll}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                paymentQuery.isFetching && "animate-spin",
              )}
            />
            Refresh
          </Button>

          <Link
            to={`/payments/${encodedId}/refunds`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
          >
            <RotateCcw className="h-4 w-4" />
            Refunds
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="Payment Amount"
          value={money(payment.amountMinor, payment.currency)}
          description={payment.currency}
          icon={CreditCard}
        />
        <Metric
          title="Captured"
          value={money(payment.capturedMinor, payment.currency)}
          description="Confirmed captured amount"
          icon={CheckCircle2}
        />
        <Metric
          title="Refunded"
          value={money(payment.refundedMinor, payment.currency)}
          description="Total refunded amount"
          icon={ArrowUpRight}
        />
        <Metric
          title="Available to Refund"
          value={money(refundable, payment.currency)}
          description="Captured minus refunded"
          icon={ArrowDownLeft}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Payment ID" value={payment.id ?? paymentId} />
            <Detail
              label="Customer"
              value={payment.customerLabel ?? payment.customerReference}
            />
            <Detail
              label="Customer Reference"
              value={payment.customerReference}
            />
            <Detail
              label="Merchant Reference"
              value={payment.merchantReference}
            />
            <Detail label="Created" value={formatDate(payment.createdAt)} />
            <Detail label="Updated" value={formatDate(payment.updatedAt)} />
            <Detail label="Status Reason" value={payment.statusReason} />
            <Detail label="Currency" value={payment.currency} />
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <PaymentTimeline
          events={timeline}
          isLoading={timelineQuery.isPending}
          error={timelineQuery.error}
          onRetry={() => timelineQuery.refetch()}
        />

        <PaymentAttempts
          attempts={attempts}
          isLoading={attemptsQuery.isPending}
          error={attemptsQuery.error}
          onRetry={() => attemptsQuery.refetch()}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5 sm:pt-6">
          <div className="flex items-center gap-3">
            <ReceiptText
              className="h-5 w-5 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold">Refund Management</p>
              <p className="text-xs text-slate-500">
                View refunds and available refund balance.
              </p>
            </div>
          </div>

          <Link to={`/payments/${encodedId}/refunds`} className="btn-secondary">
            Manage Refunds
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default PaymentDetails;

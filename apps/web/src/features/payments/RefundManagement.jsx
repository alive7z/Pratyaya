
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, AlertTriangle, RefreshCw } from "lucide-react";
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
import { Label } from "../../components/ui/Label.jsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/Dialog.jsx";

const initialForm = { amount: "", reason: "", full: false };

const refundVariants = {
  REQUESTED: "secondary",
  QUEUED: "warning",
  PROCESSING: "info",
  SUCCEEDED: "success",
  FAILED: "destructive",
  UNKNOWN: "warning",
  CANCELLED: "secondary",
};

const pendingStatuses = new Set([
  "REQUESTED",
  "QUEUED",
  "PROCESSING",
  "UNKNOWN",
]);

function getPayload(response) {
  return response?.data?.data ?? response?.data;
}

function getRefunds(response) {
  const data = getPayload(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.refunds)) return data.refunds;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

function minor(value) {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function money(value, currency) {
  return formatMoney(String(value ?? 0), currency);
}

function date(value) {
  if (!value) return "—";
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? "—" : result.toLocaleString();
}

function Metric({ label, value, description }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

export function RefundManagement() {
  const { paymentId } = useParams();
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const idempotencyKey = useRef(null);
  const encodedId = encodeURIComponent(paymentId ?? "");
  const merchantId = auth?.merchantId ?? null;
  const enabled = Boolean(auth && paymentId);

  const canRefund =
    auth?.permissions?.includes("refunds.create") ||
    auth?.permissions?.includes("payments.refund") ||
    false;

  const paymentQuery = useQuery({
    queryKey: ["payment", merchantId, paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${encodedId}`),
    enabled,
  });

  const refundsQuery = useQuery({
    queryKey: ["refunds", merchantId, paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${encodedId}/refunds`),
    enabled,
  });

  const payload = getPayload(paymentQuery.data);
  const payment = payload?.payment ?? payload;
  const refunds = getRefunds(refundsQuery.data);

  const captured = minor(payment?.capturedMinor);
  const refunded = minor(payment?.refundedMinor);

  const pending = refunds
    .filter((refund) => pendingStatuses.has(refund.status))
    .reduce((total, refund) => total + minor(refund.amountMinor), 0n);

  const confirmedAvailable = captured > refunded ? captured - refunded : 0n;
  const available =
    confirmedAvailable > pending ? confirmedAvailable - pending : 0n;

  const mutation = useMutation({
    mutationFn: ({ data, key }) =>
      apiClient.post(
        `/api/v1/payments/${encodedId}/refunds`,
        data,
        { headers: { "Idempotency-Key": key } },
      ),
    onSuccess: async () => {
      idempotencyKey.current = null;
      setOpen(false);
      setForm(initialForm);
      setError("");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payment"] }),
        queryClient.invalidateQueries({ queryKey: ["refunds"] }),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["ledger"] }),
      ]);
    },
    onError: (requestError) => {
      setError(requestError?.message ?? "Unable to create refund.");
    },
  });

  const updateForm = (field, value) => {
    idempotencyKey.current = null;
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleOpenChange = (nextOpen) => {
    if (mutation.isPending) return;

    setOpen(nextOpen);

    if (!nextOpen) {
      setForm(initialForm);
      setError("");
      idempotencyKey.current = null;
    }
  };

  const submit = (event) => {
    event.preventDefault();

    if (mutation.isPending || !canRefund || !payment) return;

    const amount = form.full ? available.toString() : form.amount;

    if (!/^[1-9]\d*$/.test(amount)) {
      setError("Enter a valid positive refund amount.");
      return;
    }

    if (BigInt(amount) > available) {
      setError("Refund amount exceeds the available balance.");
      return;
    }

    if (!idempotencyKey.current) {
      idempotencyKey.current = `refund_${crypto.randomUUID()}`;
    }

    mutation.mutate({
      data: {
        amountMinor: amount,
        currency: payment.currency,
        reason: form.reason.trim(),
      },
      key: idempotencyKey.current,
    });
  };

  const loading = enabled && (paymentQuery.isPending || refundsQuery.isPending);
  const queryError = paymentQuery.error || refundsQuery.error;

  const refresh = () => {
    paymentQuery.refetch();
    refundsQuery.refetch();
  };

  if (!enabled) {
    return (
      <div className="py-12 text-center text-sm">
        <p>Sign in to manage refunds.</p>
        <Link to="/login" className="mt-3 inline-block text-blue-600">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
    );
  }

  if (queryError || !payment) {
    return (
      <div role="alert" className="space-y-3 py-10 text-center">
        <p className="text-sm text-red-600">
          {queryError?.message ?? "Payment not found."}
        </p>
        <Button variant="outline" onClick={refresh}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              to={`/payments/${encodedId}`}
              aria-label="Back to payment"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Refund Management
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {payment.reference ?? paymentId}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>

          {canRefund && (
            <Button
              disabled={available <= 0n}
              onClick={() => handleOpenChange(true)}
            >
              <Plus className="h-4 w-4" />
              Request Refund
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Captured"
          value={money(captured, payment.currency)}
          description="Confirmed captured amount"
        />
        <Metric
          label="Refunded"
          value={money(refunded, payment.currency)}
          description="Confirmed refunds"
        />
        <Metric
          label="Available to Refund"
          value={money(available, payment.currency)}
          description="Excludes pending refund reservations"
        />
      </div>

      {pending > 0n && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {money(pending, payment.currency)} is reserved for
            pending or uncertain refunds.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Refund History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                <tr>
                  {["Refund ID", "Amount", "Status", "Reason", "Created"].map(
                    (heading) => (
                      <th key={heading} className="whitespace-nowrap px-3 py-3">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {refunds.length ? (
                  refunds.map((refund) => (
                    <tr key={refund.id}>
                      <td className="px-3 py-3 font-mono text-xs">
                        {refund.id?.slice(-12) ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {money(refund.amountMinor, refund.currency ?? payment.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={refundVariants[refund.status] ?? "secondary"}>
                          {refund.status}
                        </Badge>
                      </td>
                      <td className="max-w-48 truncate px-3 py-3">
                        {refund.reason || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {date(refund.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No refunds requested yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Refund</DialogTitle>
            <DialogDescription>
              Available: {money(available, payment.currency)}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.full}
                disabled={mutation.isPending}
                onChange={(event) => updateForm("full", event.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Refund full available amount
            </label>

            {!form.full && (
              <div className="space-y-2">
                <Label htmlFor="refund-amount">Amount (minor units)</Label>
                <Input
                  id="refund-amount"
                  inputMode="numeric"
                  required
                  disabled={mutation.isPending}
                  value={form.amount}
                  onChange={(event) =>
                    updateForm("amount", event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="1000"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason (optional)</Label>
              <Input
                id="refund-reason"
                maxLength={500}
                disabled={mutation.isPending}
                value={form.reason}
                onChange={(event) => updateForm("reason", event.target.value)}
                placeholder="Customer request"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || available <= 0n}
                loading={mutation.isPending}
              >
                Request Refund
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RefundManagement;

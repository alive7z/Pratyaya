
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  AlertTriangle,
  Clock3,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  ArrowRight,
  Plus,
} from "lucide-react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { formatMoney } from "../../lib/format.js";
import { useToast } from "../../components/ui/Toast.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Label } from "../../components/ui/Label.jsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Input } from "../../components/ui/Input.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/Select.jsx";
import { cn } from "../../lib/utils.js";

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

const PAYMENT_STATUSES = Object.keys(STATUS_VARIANTS);

const INITIAL_FORM = {
  customerReference: "",
  amountMinor: "",
  currency: "USD",
  merchantReference: "",
  description: "",
};

function getPayments(data) {
  const payload = data?.data;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.payments)) return payload.payments;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString();
}

function validatePayment(form) {
  if (!form.customerReference.trim()) {
    return "Customer reference is required.";
  }

  if (!/^[1-9]\d*$/.test(form.amountMinor)) {
    return "Enter a valid positive amount in minor units.";
  }

  if (!["USD", "INR"].includes(form.currency)) {
    return "Select a valid currency.";
  }

  if (
    form.merchantReference &&
    !/^[A-Za-z0-9._/-]+$/.test(form.merchantReference.trim())
  ) {
    return "Order reference contains invalid characters.";
  }

  if (form.description.length > 500) {
    return "Description cannot exceed 500 characters.";
  }

  return null;
}

function PaymentMetric({ title, value, description, icon: Icon, tone }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    green:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    slate:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-5 sm:pt-6">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            colors[tone] ?? colors.slate,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

export function PaymentDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const { addToast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef(null);

  const merchantId = auth?.merchantId ?? null;
  const canCreate = auth?.permissions?.includes("payments.create") ?? false;

  const summaryQuery = useQuery({
    queryKey: ["payment-summary", merchantId],
    queryFn: () => apiClient.get("/api/v1/payments/summary"),
    enabled: Boolean(auth),
    staleTime: 15000,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", merchantId],
    queryFn: () => apiClient.get("/api/v1/payments?limit=50"),
    enabled: Boolean(auth),
    staleTime: 15000,
  });

  const payments = getPayments(paymentsQuery.data);

  const filteredPayments = payments.filter((payment) => {
    const term = search.trim().toLowerCase();

    const matchesSearch =
      !term ||
      [
        payment.reference,
        payment.customerReference,
        payment.merchantReference,
        payment.id,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(term),
      );

    const matchesStatus =
      statusFilter === "ALL" || payment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const summary = summaryQuery.data?.data ?? {};
  const counts = summary.statusCounts ?? {};

  const metrics = [
    {
      title: "Total Payments",
      value: summary.total ?? "—",
      description: "Total recorded payments",
      icon: CreditCard,
      tone: "blue",
    },
    {
      title: "Authorized",
      value: counts.AUTHORIZED ?? 0,
      description: "Awaiting capture",
      icon: CreditCard,
      tone: "blue",
    },
    {
      title: "Captured",
      value: counts.CAPTURED ?? 0,
      description: "Successfully captured",
      icon: CheckCircle2,
      tone: "green",
    },
    {
      title: "Failed",
      value: counts.FAILED ?? 0,
      description: "Failed transactions",
      icon: XCircle,
      tone: "red",
    },
    {
      title: "Processing",
      value:
        (counts.QUEUED ?? 0) +
        (counts.AUTHORIZING ?? 0) +
        (counts.CAPTURING ?? 0),
      description: "Payments in progress",
      icon: Clock3,
      tone: "amber",
    },
    {
      title: "Unknown",
      value: counts.UNKNOWN ?? 0,
      description: "Requires investigation",
      icon: AlertTriangle,
      tone: "amber",
    },
  ];

  const isFetching = summaryQuery.isFetching || paymentsQuery.isFetching;
  const isLoading = summaryQuery.isPending || paymentsQuery.isPending;
  const loadError = summaryQuery.error || paymentsQuery.error;

  const refreshPayments = async () => {
    const results = await Promise.all([
      summaryQuery.refetch(),
      paymentsQuery.refetch(),
    ]);

    const failed = results.find((result) => result.isError);

    addToast({
      title: failed ? "Refresh failed" : "Payments updated",
      description: failed
        ? failed.error?.message ?? "Unable to refresh payment data."
        : "Latest payment records loaded.",
      variant: failed ? "error" : "success",
      duration: 3000,
    });
  };

  const updateForm = (field, value) => {
    idempotencyKeyRef.current = null;
    setCreateError("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleDialogChange = (open) => {
    if (creating) return;

    setCreateOpen(open);

    if (!open) {
      setCreateError("");
      setForm(INITIAL_FORM);
      idempotencyKeyRef.current = null;
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    if (submittingRef.current || !canCreate) return;

    const validationError = validatePayment(form);

    if (validationError) {
      setCreateError(validationError);
      return;
    }

    submittingRef.current = true;
    setCreating(true);
    setCreateError("");

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `pay_create_${crypto.randomUUID()}`;
    }

    try {
      const response = await apiClient.payments.create(
        {
          customerReference: form.customerReference.trim(),
          amountMinor: form.amountMinor,
          currency: form.currency,
          merchantReference: form.merchantReference.trim() || undefined,
          description: form.description.trim() || undefined,
        },
        idempotencyKeyRef.current,
      );

      const payment = response?.data?.payment ?? response?.data;
      const paymentId = payment?.id ?? payment?._id;

      if (!paymentId) {
        throw new Error(
          "Payment creation response did not include a payment ID. Check the payment list before retrying.",
        );
      }

      idempotencyKeyRef.current = null;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments", merchantId] }),
        queryClient.invalidateQueries({
          queryKey: ["payment-summary", merchantId],
        }),
      ]);

      setCreateOpen(false);
      setForm(INITIAL_FORM);

      addToast({
        title: "Payment created",
        description: "Your synthetic payment was created successfully.",
        variant: "success",
        duration: 3000,
      });

      navigate(`/payments/${encodeURIComponent(paymentId)}`);
    } catch (error) {
      setCreateError(
        error?.message || "Unable to create payment. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Payment Operations
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage synthetic payments and monitor transaction activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={refreshPayments}
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
            Refresh
          </Button>

          {canCreate && (
            <Button size="sm" onClick={() => handleDialogChange(true)}>
              <Plus className="h-4 w-4" />
              Create Payment
            </Button>
          )}
        </div>
      </header>

      {!auth ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sign in or explore a demo role to access payments.
            </p>
            <Link
              to="/login"
              className="mt-3 inline-block text-sm font-semibold text-blue-600"
            >
              Sign in
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {loadError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              {loadError.message || "Unable to load payment data."}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric) => (
              <PaymentMetric
                key={metric.title}
                {...metric}
                value={isLoading ? "—" : metric.value}
              />
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-lg">Recent Payments</CardTitle>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Search and filter recent payment records.
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    aria-label="Search payments"
                    placeholder="Search payments..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9 sm:w-56"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    {PAYMENT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                    <tr>
                      {[
                        "Reference",
                        "Customer",
                        "Amount",
                        "Status",
                        "Created",
                        "Action",
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
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-10 text-center text-slate-500"
                        >
                          Loading payments...
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-10 text-center text-slate-500"
                        >
                          No payments found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => (
                        <tr
                          key={payment.id}
                          className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          <td className="px-3 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                            {payment.reference ?? payment.id}
                          </td>
                          <td className="px-3 py-3">
                            {payment.customerReference ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 font-medium">
                            {formatMoney(
                              payment.amountMinor,
                              payment.currency,
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant={
                                STATUS_VARIANTS[payment.status] ?? "secondary"
                              }
                            >
                              {payment.status?.replaceAll("_", " ") ?? "UNKNOWN"}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                            {formatDate(payment.createdAt)}
                          </td>
                          <td className="px-3 py-3">
                            <Link
                              to={`/payments/${encodeURIComponent(payment.id)}`}
                              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                            >
                              View
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={handleDialogChange}>
        <DialogContent
          className="max-w-md"
          onEscapeKeyDown={(event) => {
            if (creating) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (creating) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Create Payment</DialogTitle>
            <DialogDescription>
              Create a synthetic payment using minor currency units.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            {createError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {createError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="customer-reference" required>
                Customer Reference
              </Label>
              <Input
                id="customer-reference"
                required
                maxLength={120}
                disabled={creating}
                value={form.customerReference}
                onChange={(event) =>
                  updateForm("customerReference", event.target.value)
                }
                placeholder="e.g. CUSTOMER-001"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="payment-amount" required>
                  Amount
                </Label>
                <Input
                  id="payment-amount"
                  required
                  inputMode="numeric"
                  disabled={creating}
                  value={form.amountMinor}
                  onChange={(event) =>
                    updateForm(
                      "amountMinor",
                      event.target.value.replace(/\D/g, ""),
                    )
                  }
                  placeholder="1000"
                />
                <p className="text-xs text-slate-500">
                  1000 = 10.00
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-currency">
                  Currency
                </Label>
                <Select
                  value={form.currency}
                  disabled={creating}
                  onValueChange={(value) => updateForm("currency", value)}
                >
                  <SelectTrigger id="payment-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant-reference">
                Order Reference
              </Label>
              <Input
                id="merchant-reference"
                disabled={creating}
                value={form.merchantReference}
                onChange={(event) =>
                  updateForm("merchantReference", event.target.value)
                }
                placeholder="e.g. ORDER-123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-description">
                Description
              </Label>
              <Input
                id="payment-description"
                maxLength={500}
                disabled={creating}
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                placeholder="Optional description"
              />
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => handleDialogChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={creating} disabled={creating}>
                Create Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PaymentDashboard;

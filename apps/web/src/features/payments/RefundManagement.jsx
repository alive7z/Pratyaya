import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/Dialog.jsx";
import { Plus, AlertTriangle, ArrowLeft } from "lucide-react";

export function RefundManagement() {
  const { paymentId } = useParams();
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isFullRefund, setIsFullRefund] = useState(false);

  const { data: paymentData, isLoading: paymentLoading } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${paymentId}`),
    enabled: !!auth && !!paymentId,
  });

  const { data: refundsData, isLoading: refundsLoading } = useQuery({
    queryKey: ["refunds", paymentId],
    queryFn: () => apiClient.get(`/api/v1/payments/${paymentId}/refunds`),
    enabled: !!auth && !!paymentId,
  });

  const createRefundMutation = useMutation({
    mutationFn: (data) =>
      apiClient.post(`/api/v1/payments/${paymentId}/refunds`, data, {
        headers: { "Idempotency-Key": `refund-${paymentId}-${Date.now()}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds", paymentId] });
      queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
      setRefundDialogOpen(false);
      setRefundAmount("");
      setRefundReason("");
      setIsFullRefund(false);
    },
  });

  const loading = paymentLoading || refundsLoading;

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

  const payment = paymentData?.data?.payment || paymentData?.data;
  const refunds = Array.isArray(refundsData?.data)
    ? refundsData.data
    : refundsData?.data?.refunds || refundsData?.data?.items || [];

  if (!payment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-slate-400">Payment not found</p>
        <Link
          to="/payments"
          className="btn-secondary mt-4 inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to payments
        </Link>
      </div>
    );
  }

  const capturedMinor = BigInt(
    payment.capturedMinor || payment.amountMinor || 0,
  );
  const refundedMinor = BigInt(payment.refundedMinor || 0);
  const availableMinor = capturedMinor - refundedMinor;
  const pendingRefunds = refunds
    .filter((r) => ["REQUESTED", "QUEUED", "PROCESSING"].includes(r.status))
    .reduce((sum, r) => sum + BigInt(r.amountMinor), 0n);

  const handleSubmitRefund = (e) => {
    e.preventDefault();
    const amountMinor = isFullRefund ? availableMinor.toString() : refundAmount;
    if (!amountMinor || BigInt(amountMinor) <= 0n) return;
    if (BigInt(amountMinor) > availableMinor) return;
    createRefundMutation.mutate({
      amountMinor,
      currency: payment.currency,
      reason: refundReason,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              to={`/payments/${payment.id}`}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
              title="Back to payment details"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Refund Management
            </h1>
          </div>
          <p className="text-gray-500 dark:text-slate-400 mt-1 ml-9">
            Payment: {payment.reference}
          </p>
        </div>
        <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Request Refund
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Refund</DialogTitle>
              <DialogDescription>
                Payment: {payment.reference} • Available:{" "}
                {formatMoney(availableMinor, payment.currency)}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitRefund}>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="fullRefund"
                    checked={isFullRefund}
                    onChange={(e) => setIsFullRefund(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="fullRefund" className="cursor-pointer">
                    Full refund ({formatMoney(availableMinor, payment.currency)}
                    )
                  </Label>
                </div>
                {!isFullRefund && (
                  <div className="space-y-2">
                    <Label htmlFor="refundAmount">Amount (minor units)</Label>
                    <Input
                      id="refundAmount"
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      min="1"
                      max={availableMinor.toString()}
                      placeholder={availableMinor.toString()}
                      disabled={createRefundMutation.isPending}
                    />
                    <p className="text-sm text-gray-500">
                      Max available:{" "}
                      {formatMoney(availableMinor, payment.currency)} (
                      {availableMinor.toString()} minor units)
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="refundReason">Reason (optional)</Label>
                  <Input
                    id="refundReason"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Customer request, duplicate charge, etc."
                    disabled={createRefundMutation.isPending}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRefundDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createRefundMutation.isPending ||
                    (!isFullRefund && !refundAmount)
                  }
                >
                  {createRefundMutation.isPending
                    ? "Processing..."
                    : "Request Refund"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Captured Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(capturedMinor, payment.currency)}
            </div>
            <p className="text-xs text-gray-500">Total captured</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Confirmed Refunded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatMoney(refundedMinor, payment.currency)}
            </div>
            <p className="text-xs text-gray-500">Successfully refunded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Available to Refund
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatMoney(availableMinor, payment.currency)}
            </div>
            <p className="text-xs text-gray-500">Captured - Refunded</p>
          </CardContent>
        </Card>
      </div>

      {pendingRefunds > 0n && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-amber-800 p-4">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-medium">Pending Refunds Reserved</p>
                <p className="text-sm">
                  {formatMoney(pendingRefunds, payment.currency)} reserved
                  across{" "}
                  {
                    refunds.filter((r) =>
                      ["REQUESTED", "QUEUED", "PROCESSING"].includes(r.status),
                    ).length
                  }{" "}
                  pending refund(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Refund History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-gray-500">
                  <th className="pb-3 font-medium">Refund ID</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Reason</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium">Confirmed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {refunds.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No refunds requested yet
                    </td>
                  </tr>
                ) : (
                  refunds.map((refund) => (
                    <tr key={refund.id} className="hover:bg-gray-50">
                      <td className="py-3 text-sm font-mono">
                        {refund.id.slice(-12)}
                      </td>
                      <td className="py-3 text-sm">
                        {formatMoney(refund.amountMinor, refund.currency)}
                      </td>
                      <td className="py-3">
                        <Badge variant={getRefundVariant(refund.status)}>
                          {refund.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm text-gray-600 max-w-xs truncate">
                        {refund.reason || "—"}
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {new Date(refund.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {refund.confirmedAt
                          ? new Date(refund.confirmedAt).toLocaleString()
                          : "—"}
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

function getRefundVariant(status) {
  const variants = {
    REQUESTED: "secondary",
    QUEUED: "secondary",
    PROCESSING: "default",
    SUCCEEDED: "success",
    FAILED: "destructive",
    UNKNOWN: "destructive",
    CANCELLED: "secondary",
  };
  return variants[status] || "secondary";
}


import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Webhook,
} from "lucide-react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog.jsx";

const STATUS_VARIANTS = {
  PENDING: "secondary",
  PROCESSING: "default",
  COMPLETED: "success",
  FAILED: "destructive",
};

function getEvents(response) {
  const data = response?.data?.data ?? response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <Card>
      <CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 p-5 text-center">
        <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <p className="text-3xl font-bold tabular-nums text-slate-950 dark:text-white">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function WebhookExplorer() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [actionError, setActionError] = useState("");

  const merchantId = auth?.merchantId ?? null;

  const {
    data,
    isPending,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["webhooks", merchantId],
    queryFn: () => apiClient.get("/api/v1/webhooks/inbox?limit=50"),
    enabled: Boolean(auth),
    refetchInterval: 10000,
  });

  const retryMutation = useMutation({
    mutationFn: (eventId) =>
      apiClient.post(
        `/api/v1/webhooks/inbox/${encodeURIComponent(eventId)}/retry`,
      ),
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: ["webhooks", merchantId] });
    },
    onError: (err) => {
      setActionError(err?.message ?? "Unable to retry webhook.");
    },
  });

  const webhooks = getEvents(data);

  const stats = [
    {
      title: "Total Events",
      value: webhooks.length,
      icon: Webhook,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Verified",
      value: webhooks.filter((item) => item.signatureVerified === true).length,
      icon: CheckCircle2,
      color: "text-emerald-600",
    },
    {
      title: "Invalid Signatures",
      value: webhooks.filter((item) => item.signatureVerified === false).length,
      icon: XCircle,
      color: "text-red-600",
    },
    {
      title: "Processing Failed",
      value: webhooks.filter((item) => item.processingStatus === "FAILED").length,
      icon: AlertTriangle,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Webhook Explorer
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Inspect incoming provider events and processing status.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={!auth || isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </header>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {actionError}
        </div>
      )}

      {!auth ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Sign in or start a demo session to view webhooks.
          </CardContent>
        </Card>
      ) : isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {error?.message ?? "Unable to load webhooks."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Provider Webhooks ({webhooks.length})
              </CardTitle>
            </CardHeader>

            <CardContent>
              {webhooks.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Webhook className="h-9 w-9 text-slate-400" />
                  <p className="mt-3 text-sm font-medium">
                    No webhooks received yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Incoming provider events will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                      <tr>
                        {[
                          "Event ID",
                          "Type",
                          "Payment",
                          "Signature",
                          "Status",
                          "Received",
                          "Processed",
                          "Actions",
                        ].map((heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="whitespace-nowrap px-3 py-3 font-medium"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {webhooks.map((webhook) => (
                        <tr
                          key={webhook.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          <td className="max-w-44 truncate px-3 py-3 font-mono text-xs">
                            {webhook.providerEventId ?? webhook.id}
                          </td>

                          <td className="px-3 py-3">
                            <code className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                              {webhook.eventType ?? "—"}
                            </code>
                          </td>

                          <td className="px-3 py-3 font-mono text-xs">
                            {webhook.paymentId ? (
                              <Link
                                to={`/payments/${encodeURIComponent(webhook.paymentId)}`}
                                className="text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {webhook.paymentId.slice(-12)}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="px-3 py-3">
                            <Badge
                              variant={
                                webhook.signatureVerified === true
                                  ? "success"
                                  : webhook.signatureVerified === false
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {webhook.signatureVerified === true
                                ? "Verified"
                                : webhook.signatureVerified === false
                                  ? "Invalid"
                                  : "Unknown"}
                            </Badge>
                          </td>

                          <td className="px-3 py-3">
                            <Badge
                              variant={
                                STATUS_VARIANTS[webhook.processingStatus] ??
                                "secondary"
                              }
                            >
                              {webhook.processingStatus ?? "Unknown"}
                            </Badge>
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                            {formatDate(webhook.receivedAt)}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                            {formatDate(webhook.processedAt)}
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="View webhook"
                                onClick={() => setSelectedWebhook(webhook)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              {webhook.processingStatus === "FAILED" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label="Retry webhook"
                                  disabled={retryMutation.isPending}
                                  onClick={() =>
                                    retryMutation.mutate(webhook.id)
                                  }
                                >
                                  <RefreshCw
                                    className={`h-4 w-4 ${
                                      retryMutation.isPending &&
                                      retryMutation.variables === webhook.id
                                        ? "animate-spin"
                                        : ""
                                    }`}
                                  />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={Boolean(selectedWebhook)}
        onOpenChange={(open) => !open && setSelectedWebhook(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Details</DialogTitle>
            <DialogDescription className="break-all">
              {selectedWebhook?.providerEventId ?? selectedWebhook?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedWebhook && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Event Type", selectedWebhook.eventType],
                  ["Processing Status", selectedWebhook.processingStatus],
                  ["Received", formatDate(selectedWebhook.receivedAt)],
                  ["Processed", formatDate(selectedWebhook.processedAt)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"
                  >
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 wrap-break-word text-sm font-medium">
                      {value ?? "—"}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Event Payload</h3>
                <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-200">
                  {JSON.stringify(
                    selectedWebhook.payload ?? {},
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WebhookExplorer;

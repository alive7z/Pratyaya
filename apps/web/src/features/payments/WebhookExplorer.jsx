import { useQuery } from "@tanstack/react-query";
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
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Eye,
} from "lucide-react";

export function WebhookExplorer() {
  const { auth } = useAuth();

  const {
    data: webhooksData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["webhooks", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/webhooks/inbox?limit=50"),
    enabled: !!auth,
    refetchInterval: 10000,
  });

  const webhooks = webhooksData?.data?.events || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhook Explorer</h1>
          <p className="text-gray-500 mt-1">
            Incoming provider webhooks and delivery status
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 animate-pulse rounded"
                />
              ))}
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No webhooks received yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Webhooks will appear here when the provider sends events
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Event ID</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Payment</th>
                    <th className="pb-3 font-medium">Signature</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Received</th>
                    <th className="pb-3 font-medium">Processed</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {webhooks.map((webhook) => (
                    <tr key={webhook.id} className="hover:bg-gray-50">
                      <td className="py-3 text-sm font-mono">
                        {webhook.providerEventId}
                      </td>
                      <td className="py-3 text-sm">
                        <code className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {webhook.eventType}
                        </code>
                      </td>
                      <td className="py-3 text-sm font-mono text-gray-600">
                        {webhook.paymentId?.slice(-12) || "—"}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            webhook.signatureVerified
                              ? "success"
                              : "destructive"
                          }
                        >
                          {webhook.signatureVerified ? "Verified" : "Invalid"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={getStatusVariant(webhook.processingStatus)}
                        >
                          {webhook.processingStatus}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {new Date(webhook.receivedAt).toLocaleString()}
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {webhook.processedAt
                          ? new Date(webhook.processedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewWebhook(webhook)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {webhook.processingStatus === "FAILED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => retryWebhook(webhook.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
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

      {webhooks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                title="Total Events"
                value={webhooks.length}
                icon={ExternalLink}
              />
              <StatCard
                title="Verified"
                value={webhooks.filter((w) => w.signatureVerified).length}
                icon={CheckCircle}
                color="text-green-600"
              />
              <StatCard
                title="Failed Verification"
                value={webhooks.filter((w) => !w.signatureVerified).length}
                icon={XCircle}
                color="text-red-600"
              />
              <StatCard
                title="Processing Failed"
                value={
                  webhooks.filter((w) => w.processingStatus === "FAILED").length
                }
                icon={AlertTriangle}
                color="text-yellow-600"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color = "text-blue-600" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`p-2 rounded-lg bg-gray-100 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusVariant(status) {
  const variants = {
    PENDING: "secondary",
    PROCESSING: "default",
    COMPLETED: "success",
    FAILED: "destructive",
  };
  return variants[status] || "secondary";
}

async function viewWebhook(webhook) {
  alert(JSON.stringify(webhook.payload, null, 2));
}

async function retryWebhook(eventId) {
  try {
    await apiClient.post(`/api/v1/webhooks/inbox/${eventId}/retry`);
  } catch (error) {
    alert(`Retry failed: ${error.message}`);
  }
}

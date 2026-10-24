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
import { Alert } from "../../components/ui/Alert.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";

export function RiskRules() {
  const { auth } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["risk-rules", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/risk/rules"),
    enabled: Boolean(auth),
  });
  const rules = data?.data?.rules ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Risk rules
        </h1>
        <p className="mt-1 text-gray-500 dark:text-slate-400">
          Read-only view of deterministic rules used by the synthetic risk
          engine.
        </p>
      </div>

      <Alert>
        Rule mutation is intentionally unavailable in this milestone. This
        prevents a demo role from changing platform-wide policy without a
        dedicated administration permission and audit workflow.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Active rules ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">Unable to load risk rules.</Alert>
          ) : rules.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              No active rules are configured.
            </p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <article
                  key={rule.ruleCode}
                  className="rounded-lg border border-gray-200 p-4 dark:border-slate-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {rule.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {rule.ruleCode} · {rule.type}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge>{rule.severity}</Badge>
                      <Badge variant="outline">{rule.action}</Badge>
                    </div>
                  </div>
                  {rule.description ? (
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                      {rule.description}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

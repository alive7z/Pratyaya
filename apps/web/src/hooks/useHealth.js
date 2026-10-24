import { useQuery } from "@tanstack/react-query";
import { healthApi } from "../lib/apiClient.js";

export function useHealth() {
  const liveness = useQuery({
    queryKey: ["health", "liveness"],
    queryFn: healthApi.getLiveness,
    refetchInterval: 15_000,
  });

  const readiness = useQuery({
    queryKey: ["health", "readiness"],
    queryFn: healthApi.getReadiness,
    refetchInterval: 15_000,
  });

  const isOffline = liveness.isError || readiness.isError;
  const readinessData = readiness.data?.data;
  const livenessData = liveness.data?.data;

  let overall = "checking";
  if (isOffline) overall = "unreachable";
  else if (readinessData?.status === "ready") overall = "ready";
  else if (readinessData) overall = "degraded";

  function refetch() {
    void liveness.refetch();
    void readiness.refetch();
  }

  return {
    liveness,
    readiness,
    livenessData,
    readinessData,
    overall,
    isOffline,
    isLoading: liveness.isPending || readiness.isPending,
    isFetching: liveness.isFetching || readiness.isFetching,
    error: liveness.error ?? readiness.error ?? null,
    lastUpdatedAt: Math.max(liveness.dataUpdatedAt, readiness.dataUpdatedAt),
    refetch,
  };
}

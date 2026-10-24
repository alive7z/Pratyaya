
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Play,
  RefreshCw,
  XCircle,
  Zap,
  Bug,
} from "lucide-react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Input } from "../../components/ui/Input.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/Select.jsx";

const SCENARIOS = [
  {
    id: "timeout",
    name: "Provider Timeout",
    description: "Simulate an uncertain provider response.",
    icon: Clock3,
    rules: [{ type: "timeout", enabled: true, delayMs: 30000 }],
  },
  {
    id: "decline",
    name: "Provider Decline",
    description: "Simulate a rejected payment authorization.",
    icon: XCircle,
    rules: [{
      type: "decline",
      enabled: true,
      code: "PROVIDER_DECLINED",
      message: "Simulated decline",
    }],
  },
  {
    id: "latency",
    name: "High Latency",
    description: "Introduce artificial provider processing delay.",
    icon: Zap,
    rules: [{ type: "latency", enabled: true, delayMs: 5000 }],
  },
  {
    id: "error",
    name: "Provider Error",
    description: "Simulate an internal provider failure.",
    icon: Bug,
    rules: [{
      type: "error",
      enabled: true,
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "Simulated provider error",
    }],
  },
];

const TERMINAL_STATUSES = new Set([
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "UNKNOWN",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getPayload(response) {
  return response?.data?.data ?? response?.data ?? {};
}

function getPaymentId(response) {
  const data = getPayload(response);
  return data.payment?.id ?? data.paymentId ?? data.id ?? null;
}

function getPayment(response) {
  const data = getPayload(response);
  return data.payment ?? data;
}

export function ReliabilityLab() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  const [scenarioId, setScenarioId] = useState("timeout");
  const [paymentId, setPaymentId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const runningRef = useRef(false);

  const scenario = SCENARIOS.find((item) => item.id === scenarioId);

  const faultsQuery = useQuery({
    queryKey: ["provider-faults", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/sandbox/faults"),
    enabled: Boolean(auth),
  });

  const faults = getPayload(faultsQuery.data).faults ?? {
    enabled: false,
    rules: [],
  };

  const log = (message, type = "info") => {
    setLogs((current) => [
      ...current,
      {
        time: new Date().toLocaleTimeString(),
        message,
        type,
      },
    ]);
  };

  const clearFaults = async () => {
    await apiClient.delete("/api/v1/sandbox/faults");
    await queryClient.invalidateQueries({
      queryKey: ["provider-faults"],
    });
  };

  const runTest = async () => {
    if (!auth || runningRef.current) return;

    runningRef.current = true;
    setRunning(true);
    setResult(null);
    setLogs([]);

    let faultApplied = false;

    try {
      if (faults.enabled) {
        throw new Error(
          "Clear the existing fault configuration before running a test.",
        );
      }

      log(`Applying ${scenario.name} scenario`);

      await apiClient.post("/api/v1/sandbox/faults", {
        enabled: true,
        rules: scenario.rules,
      });

      faultApplied = true;

      const existingId = paymentId.trim();
      let targetId = existingId;

      if (!targetId) {
        log("Creating synthetic test payment");

        const response = await apiClient.post(
          "/api/v1/payments",
          {
            customerReference: `RELIABILITY-${scenario.id.toUpperCase()}`,
            merchantReference: `LAB-${crypto.randomUUID()}`,
            amountMinor: "10000",
            currency: "USD",
            description: `Reliability test: ${scenario.name}`,
          },
          {
            headers: {
              "Idempotency-Key": `lab_${crypto.randomUUID()}`,
            },
          },
        );

        targetId = getPaymentId(response);

        if (!targetId) {
          throw new Error(
            "Payment creation returned no payment ID. Check payment history before retrying.",
          );
        }

        setPaymentId(targetId);
      } else {
        log(`Using payment ${targetId}`);
      }

      log(`Payment ID: ${targetId}`);
      log("Checking payment state transitions");

      let latestStatus = null;
      let completed = false;

      for (let attempt = 0; attempt < 12; attempt++) {
        const response = await apiClient.get(
          `/api/v1/payments/${encodeURIComponent(targetId)}`,
        );

        const payment = getPayment(response);
        const status = payment?.status ?? null;

        if (status !== latestStatus) {
          latestStatus = status;
          log(`Payment status: ${status ?? "Unavailable"}`);
        }

        if (TERMINAL_STATUSES.has(status)) {
          completed = true;
          break;
        }

        if (attempt < 11) await sleep(2500);
      }

      const expected = {
        timeout: ["UNKNOWN"],
        decline: ["FAILED"],
        latency: ["AUTHORIZED", "CAPTURED"],
        error: ["FAILED", "UNKNOWN"],
      }[scenario.id];

      if (!completed) {
        setResult({
          status: "inconclusive",
          message:
            "The payment did not reach an expected observable state within the test window.",
        });
      } else if (expected.includes(latestStatus)) {
        setResult({
          status: "passed",
          message: `Observed expected payment status: ${latestStatus}.`,
        });
      } else {
        setResult({
          status: "failed",
          message: `Expected ${expected.join(" or ")}, received ${latestStatus}.`,
        });
      }

      log("Scenario observation completed");
    } catch (error) {
      log(error?.message ?? "Test failed", "error");

      setResult({
        status: "failed",
        message: error?.message ?? "Unable to complete the test.",
      });
    } finally {
      if (faultApplied) {
        try {
          await clearFaults();
          log("Fault configuration cleared");
        } catch (error) {
          log(`Fault cleanup failed: ${error.message}`, "error");
          setResult({
            status: "failed",
            message:
              "Fault cleanup failed. Clear active faults before running another test.",
          });
        }
      }

      runningRef.current = false;
      setRunning(false);
    }
  };

  const resultStyle = {
    passed:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
    failed:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
    inconclusive:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Reliability Lab
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Inject synthetic provider failures and observe payment recovery.
        </p>
      </header>

      {faults.enabled && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold">Fault injection active</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {(faults.rules ?? []).map((rule) => rule.type).join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCENARIOS.map((item) => {
          const Icon = item.icon;
          const selected = scenarioId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              disabled={running}
              aria-pressed={selected}
              onClick={() => setScenarioId(item.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30"
                  : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon
                  className="h-5 w-5 text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />
                {selected && (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
              </div>
              <p className="mt-3 text-sm font-semibold">{item.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="test-payment-id"
                className="mb-2 block text-sm font-medium"
              >
                Payment ID
              </label>
              <Input
                id="test-payment-id"
                value={paymentId}
                disabled={running}
                onChange={(event) => setPaymentId(event.target.value)}
                placeholder="Leave empty to create a test payment"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Fault Scenario
              </label>
              <Select
                value={scenarioId}
                disabled={running}
                onValueChange={setScenarioId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              disabled={!auth || running || faults.enabled}
              onClick={runTest}
            >
              {running ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {running ? "Running Test..." : "Run Test"}
            </Button>

            <p className="text-xs leading-relaxed text-slate-500">
              This test observes payment status only. It does not
              independently verify ledger consistency or recovery behavior.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              role="log"
              aria-live="polite"
              className="h-72 space-y-2 overflow-y-auto rounded-lg bg-slate-950 p-4 font-mono text-xs"
            >
              {logs.length === 0 ? (
                <p className="text-slate-500">
                  Run a test to view activity.
                </p>
              ) : (
                logs.map((entry, index) => (
                  <p
                    key={index}
                    className={
                      entry.type === "error"
                        ? "text-red-400"
                        : "text-emerald-400"
                    }
                  >
                    <span className="text-slate-500">
                      [{entry.time}]
                    </span>{" "}
                    {entry.message}
                  </p>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {result && (
        <div
          role="status"
          className={`rounded-xl border p-5 ${resultStyle[result.status]}`}
        >
          <div className="flex items-center gap-2">
            {result.status === "passed" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            <h2 className="font-semibold">
              {result.status === "passed"
                ? "Expected Status Observed"
                : result.status === "failed"
                  ? "Test Failed"
                  : "Test Inconclusive"}
            </h2>
          </div>
          <p className="mt-2 text-sm">{result.message}</p>
        </div>
      )}
    </div>
  );
}

export default ReliabilityLab;

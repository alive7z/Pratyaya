import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/Select.jsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/Alert.jsx";
import {
  Loader2,
  Play,
  Bug,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";

const FAULT_SCENARIOS = [
  {
    id: "timeout",
    name: "Provider Timeout",
    description:
      "Provider processes request but response is delayed beyond client timeout",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    faultConfig: {
      enabled: true,
      rules: [{ type: "timeout", enabled: true, delayMs: 30000 }],
    },
  },
  {
    id: "decline",
    name: "Provider Decline",
    description: "Provider explicitly rejects the authorization or capture",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    faultConfig: {
      enabled: true,
      rules: [
        {
          type: "decline",
          enabled: true,
          code: "PROVIDER_DECLINED",
          message: "Simulated decline",
        },
      ],
    },
  },
  {
    id: "latency",
    name: "High Latency",
    description: "Artificial latency added to provider operations",
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    faultConfig: {
      enabled: true,
      rules: [{ type: "latency", enabled: true, delayMs: 5000 }],
    },
  },
  {
    id: "error",
    name: "Provider Error",
    description: "Provider returns a 5xx error response",
    icon: Bug,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    faultConfig: {
      enabled: true,
      rules: [
        {
          type: "error",
          enabled: true,
          statusCode: 500,
          code: "INTERNAL_ERROR",
          message: "Simulated provider error",
        },
      ],
    },
  },
];

export function ReliabilityLab() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [selectedScenario, setSelectedScenario] = useState(FAULT_SCENARIOS[0]);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testLogs, setTestLogs] = useState([]);
  const [paymentId, setPaymentId] = useState("");

  const { data: faultsData } = useQuery({
    queryKey: ["provider-faults"],
    queryFn: () => apiClient.get("/api/v1/sandbox/faults"),
    enabled: !!auth,
  });

  const currentFaults = faultsData?.data?.faults || {
    enabled: false,
    rules: [],
  };

  const setFaultsMutation = useMutation({
    mutationFn: (config) => apiClient.post("/api/v1/sandbox/faults", config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-faults"] });
    },
  });

  const clearFaultsMutation = useMutation({
    mutationFn: () => apiClient.delete("/api/v1/sandbox/faults"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-faults"] });
    },
  });

  const runTest = async () => {
    if (!paymentId) {
      alert("Please create a payment first or enter a payment ID");
      return;
    }

    setTestRunning(true);
    setTestResult(null);
    setTestLogs([]);

    const addLog = (message, type = "info") => {
      setTestLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), message, type },
      ]);
    };

    try {
      addLog(`Setting up fault: ${selectedScenario.name}`);
      await setFaultsMutation.mutateAsync(selectedScenario.faultConfig);

      addLog("Creating test payment...");
      const paymentRes = await apiClient.post(
        "/api/v1/payments",
        {
          amountMinor: "10000",
          currency: "USD",
          description: `Reliability test: ${selectedScenario.name}`,
        },
        {
          headers: { "Idempotency-Key": `test-${Date.now()}` },
        },
      );
      const testPaymentId = paymentRes.data.payment.id;
      addLog(`Created payment: ${testPaymentId}`);

      addLog("Waiting for worker to process authorization...");
      await new Promise((r) => setTimeout(r, 3000));

      addLog("Checking payment status...");
      const statusRes = await apiClient.get(
        `/api/v1/payments/${testPaymentId}`,
      );
      const status = statusRes.data.payment.status;
      addLog(`Payment status: ${status}`);

      addLog("Clearing fault configuration...");
      await clearFaultsMutation.mutateAsync();

      if (selectedScenario.id === "timeout" && status === "UNKNOWN") {
        setTestResult({
          success: true,
          message: "Correctly entered UNKNOWN state after timeout",
        });
      } else if (selectedScenario.id === "decline" && status === "FAILED") {
        setTestResult({
          success: true,
          message: "Correctly failed after provider decline",
        });
      } else if (selectedScenario.id === "latency" && status === "AUTHORIZED") {
        setTestResult({
          success: true,
          message: "Completed successfully despite latency",
        });
      } else if (selectedScenario.id === "error" && status === "FAILED") {
        setTestResult({
          success: true,
          message: "Correctly failed after provider error",
        });
      } else {
        setTestResult({
          success: false,
          message: `Unexpected status: ${status}`,
        });
      }
    } catch (error) {
      addLog(`Error: ${error.message}`, "error");
      setTestResult({ success: false, message: error.message });
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reliability Lab</h1>
          <p className="text-gray-500 mt-1">
            Test fault scenarios and observe system recovery behavior
          </p>
        </div>
        {currentFaults.enabled && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Fault Active</AlertTitle>
            <AlertDescription>
              {currentFaults.rules.map((r) => r.type).join(", ")} fault
              injection is enabled
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {FAULT_SCENARIOS.map((scenario) => (
          <Card
            key={scenario.id}
            className={`border-2 transition-colors ${selectedScenario.id === scenario.id ? "border-blue-500" : "border-gray-200"} ${scenario.bgColor}`}
            onClick={() => setSelectedScenario(scenario)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${scenario.bgColor.replace("bg-", "bg-").replace("50", "100")}`}
                >
                  <scenario.icon className={`h-5 w-5 ${scenario.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{scenario.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {scenario.description}
                  </p>
                </div>
                {selectedScenario.id === scenario.id && (
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Payment ID (optional - will create new if empty)
              </label>
              <input
                type="text"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                placeholder="Leave empty to create new payment"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Selected Scenario
              </label>
              <Select
                value={selectedScenario.id}
                onValueChange={setSelectedScenario}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  {FAULT_SCENARIOS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={runTest}
              disabled={testRunning}
              className="w-full"
              size="lg"
            >
              {testRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running Test...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {testResult && (
          <Card
            className={
              testResult.success
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
          >
            <CardHeader>
              <CardTitle
                className={
                  testResult.success ? "text-green-800" : "text-red-800"
                }
              >
                {testResult.success ? "Test Passed" : "Test Failed"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={
                  testResult.success ? "text-green-700" : "text-red-700"
                }
              >
                {testResult.message}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Test Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-y-auto bg-gray-900 rounded p-4 font-mono text-xs text-green-400">
              {testLogs.length === 0 ? (
                <p className="text-gray-500">Run a test to see logs</p>
              ) : (
                testLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`mb-1 ${log.type === "error" ? "text-red-400" : ""}`}
                  >
                    <span className="text-gray-500">[{log.time}]</span>{" "}
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expected vs Actual Behavior</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                Scenario: {selectedScenario.name}
              </h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Payment created and queued</li>
                <li>• Worker picks up authorization job</li>
                <li>• Provider call made with fault injected</li>
                <li>• System handles fault appropriately</li>
                <li>• Payment enters correct state (UNKNOWN/FAILED)</li>
                <li>• No duplicate financial effects</li>
                <li>• Reconciliation can resolve UNKNOWN</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                Key Recovery Behaviors
              </h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Original provider operation ID preserved</li>
                <li>• No new operation created on retry</li>
                <li>• Reconciliation queries provider with same ID</li>
                <li>• Ledger posted exactly once on confirmation</li>
                <li>• Idempotency prevents duplicate journals</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

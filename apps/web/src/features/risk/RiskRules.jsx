import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Input } from "../../components/ui/Input.jsx";
import { Label } from "../../components/ui/Label.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/Select.jsx";
import {
  Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "../../components/ui/Modal.jsx";
import { Plus, Trash2, Edit } from "lucide-react";

export function RiskRules() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    ruleCode: "",
    name: "",
    type: "VELOCITY",
    action: "SCORE_INCREMENT",
    severity: "MEDIUM",
    scoreIncrement: 10,
    conditions: {},
    isActive: true,
    priority: 0,
  });
  const [validationErrors, setValidationErrors] = useState({});

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ["risk-rules", auth?.merchantId],
    queryFn: () => apiClient.get("/api/v1/risk/rules"),
    enabled: !!auth,
  });

  const rules = rulesData?.data?.rules || [];

  const createMutation = useMutation({
    mutationFn: (data) =>
      apiClient.post("/api/v1/risk/rules", data, {
        headers: { "Idempotency-Key": `rule-${Date.now()}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk-rules"] });
      setRuleDialogOpen(false);
      setEditingRule(null);
      setFormData({
        ruleCode: "",
        name: "",
        type: "VELOCITY",
        action: "SCORE_INCREMENT",
        severity: "MEDIUM",
        scoreIncrement: 10,
        conditions: {},
        isActive: true,
        priority: 0,
      });
      setValidationErrors({});
    },
    onError: (error) => {
      if (error.details?.issues) {
        const errors = {};
        error.details.issues.forEach((issue) => {
          errors[issue.path.join(".")] = issue.message;
        });
        setValidationErrors(errors);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) =>
      apiClient.put(`/api/v1/risk/rules/${editingRule.ruleCode}`, data, {
        headers: { "Idempotency-Key": `rule-${Date.now()}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk-rules"] });
      setRuleDialogOpen(false);
      setEditingRule(null);
      setFormData({
        ruleCode: "",
        name: "",
        type: "VELOCITY",
        action: "SCORE_INCREMENT",
        severity: "MEDIUM",
        scoreIncrement: 10,
        conditions: {},
        isActive: true,
        priority: 0,
      });
      setValidationErrors({});
    },
    onError: (error) => {
      if (error.details?.issues) {
        const errors = {};
        error.details.issues.forEach((issue) => {
          errors[issue.path.join(".")] = issue.message;
        });
        setValidationErrors(errors);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleCode) =>
      apiClient.delete(`/api/v1/risk/rules/${ruleCode}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk-rules"] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingRule) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData({
      ruleCode: "",
      name: "",
      type: "VELOCITY",
      action: "SCORE_INCREMENT",
      severity: "MEDIUM",
      scoreIncrement: 10,
      conditions: {},
      isActive: true,
      priority: 0,
    });
    setValidationErrors({});
    setRuleDialogOpen(true);
  };

  const openEditDialog = (rule) => {
    setEditingRule(rule);
    setFormData({
      ruleCode: rule.ruleCode,
      name: rule.name,
      type: rule.type,
      action: rule.action,
      severity: rule.severity,
      scoreIncrement: rule.scoreIncrement,
      conditions: rule.conditions || {},
      isActive: rule.isActive,
      priority: rule.priority,
    });
    setValidationErrors({});
    setRuleDialogOpen(true);
  };

  const handleDelete = async (ruleCode) => {
    if (window.confirm("Are you sure you want to delete this rule?")) {
      deleteMutation.mutate(ruleCode);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Rules</h1>
          <p className="text-gray-500 mt-1">
            Configure and manage fraud detection rules
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <Modal open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <ModalTrigger asChild>
          <Button variant="ghost" className="hidden">
            Hidden trigger
          </Button>
        </ModalTrigger>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>
              {editingRule ? "Edit Rule" : "Create New Rule"}
            </ModalTitle>
            <ModalDescription>
              Configure a new risk rule to detect suspicious payment patterns
            </ModalDescription>
          </ModalHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="ruleCode">Rule Code</Label>
                <Input
                  id="ruleCode"
                  value={formData.ruleCode}
                  onChange={(e) =>
                    setFormData({ ...formData, ruleCode: e.target.value })
                  }
                  placeholder="e.g., VEL_001"
                  disabled={editingRule}
                  required
                  className={validationErrors.ruleCode ? "border-red-500" : ""}
                />
                {validationErrors.ruleCode && (
                  <p className="text-sm text-red-500 mt-1">
                    {validationErrors.ruleCode}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., High Velocity Check"
                  required
                  className={validationErrors.name ? "border-red-500" : ""}
                />
                {validationErrors.name && (
                  <p className="text-sm text-red-500 mt-1">
                    {validationErrors.name}
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label className="block text-sm font-medium mb-2">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VELOCITY">Velocity</SelectItem>
                  <SelectItem value="AMOUNT_ANOMALY">Amount Anomaly</SelectItem>
                  <SelectItem value="FAILED_ATTEMPTS">
                    Failed Attempts
                  </SelectItem>
                  <SelectItem value="PATTERN">Pattern</SelectItem>
                  <SelectItem value="GEOGRAPHIC">Geographic</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium mb-2">Action</Label>
              <Select
                value={formData.action}
                onValueChange={(v) => setFormData({ ...formData, action: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALLOW">Allow</SelectItem>
                  <SelectItem value="REVIEW">Review</SelectItem>
                  <SelectItem value="BLOCK">Block</SelectItem>
                  <SelectItem value="SCORE_INCREMENT">
                    Score Increment
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium mb-2">Severity</Label>
              <Select
                value={formData.severity}
                onValueChange={(v) => setFormData({ ...formData, severity: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block text-sm font-medium mb-2">
                Score Increment
              </Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.scoreIncrement}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    scoreIncrement: parseInt(e.target.value) || 0,
                  })
                }
                className="w-32"
              />
            </div>

            <div>
              <Label className="block text-sm font-medium mb-2">Priority</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: parseInt(e.target.value) || 0,
                  })
                }
                className="w-32"
              />
            </div>

            <div className="space-y-2">
              <Label className="block text-sm font-medium mb-2">
                Conditions (JSON)
              </Label>
              <textarea
                value={JSON.stringify(formData.conditions, null, 2)}
                onChange={(e) => {
                  try {
                    setFormData({
                      ...formData,
                      conditions: JSON.parse(e.target.value),
                    });
                  } catch {
                    // Ignore invalid JSON while typing
                  }
                }}
                className="w-full h-32 p-2 border border-gray-300 rounded-md font-mono text-sm"
                placeholder='{"count": 5, "windowMs": 3600000}'
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="isActive" className="text-sm font-medium">
                Active
              </Label>
            </div>

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRuleDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingRule
                    ? "Update Rule"
                    : "Create Rule"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Risk Rules ({rules.length})</CardTitle>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>
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
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No risk rules configured yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create your first risk rule to start detecting fraud
              </p>
              <Button onClick={openCreateDialog} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Rule Code</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Action</th>
                    <th className="pb-3 font-medium">Severity</th>
                    <th className="pb-3 font-medium">Score</th>
                    <th className="pb-3 font-medium">Priority</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rules.map((rule) => (
                    <tr key={rule.ruleCode} className="hover:bg-gray-50">
                      <td className="py-3 text-sm font-mono text-gray-600">
                        {rule.ruleCode}
                      </td>
                      <td className="py-3 text-sm font-medium">{rule.name}</td>
                      <td className="py-3">
                        <Badge variant="default" className="capitalize">
                          {rule.type}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm">
                        <Badge
                          variant={
                            rule.action === "BLOCK"
                              ? "destructive"
                              : rule.action === "REVIEW"
                                ? "default"
                                : rule.action === "ALLOW"
                                  ? "success"
                                  : "default"
                          }
                        >
                          {rule.action}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            rule.severity === "CRITICAL"
                              ? "destructive"
                              : rule.severity === "HIGH"
                                ? "destructive"
                                : rule.severity === "MEDIUM"
                                  ? "default"
                                  : "success"
                          }
                        >
                          {rule.severity}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm font-medium text-blue-600">
                        +{rule.scoreIncrement}
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {rule.priority}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={rule.isActive ? "success" : "secondary"}
                        >
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rule.ruleCode)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}

export default RiskRules;

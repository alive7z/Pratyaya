import { useState, useCallback } from "react";
import { useAuth } from "../../app/AuthContext.jsx";
import { apiClient } from "../../lib/apiClient.js";
import { formatMoney } from "../../lib/format.js";
import { AuthGate } from "../../components/AuthGate.jsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Input } from "../../components/ui/Input.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import {
  Bot,
  Inbox,
  Shield,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
} from "lucide-react";

const STATUS_BADGE = {
  PENDING_EXTRACTION: "default",
  EXTRACTED: "default",
  POLICY_CHECK_FAILED: "destructive",
  RISK_CHECK_FAILED: "destructive",
  AWAITING_APPROVAL: "default",
  APPROVED: "success",
  REJECTED: "destructive",
  EXECUTED: "success",
  EXPIRED: "default",
};

export function AgentPay() {
  const { auth } = useAuth();
  const [view, setView] = useState("dashboard");
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadPolicy = useCallback(async () => {
    try {
      const data = await apiClient.agentpay.getPolicy();
      setPolicy(data.data ?? data);
    } catch {
      setPolicy(null);
    }
  }, []);

  const loadProposals = useCallback(async () => {
    try {
      const data = await apiClient.agentpay.listInvoices({ limit: 50 });
      const items = data.data?.items || data.items || [];
      setProposals(items);
    } catch {
      setProposals([]);
    }
  }, []);

  const handleSubmitInvoice = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const invoiceText = formData.get("invoiceText");
    const idempotencyKey =
      formData.get("idempotencyKey") || `agent-${Date.now()}`;

    try {
      await apiClient.agentpay.submitInvoice({
        invoiceText,
        idempotencyKey,
      });
      setSuccess("Invoice submitted successfully");
      await loadProposals();
    } catch (err) {
      setError(err.message || "Failed to submit invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleDecide = async (decision) => {
    if (!selectedProposal) return;
    setLoading(true);
    setError(null);

    try {
      await apiClient.agentpay.decideInvoice(selectedProposal.id, {
        decision,
        reason: decision === "REJECT" ? "Manual review rejection" : undefined,
      });
      setSuccess(`Proposal ${decision.toLowerCase()}d successfully`);
      setSelectedProposal(null);
      await loadProposals();
    } catch (err) {
      setError(err.message || `Failed to ${decision.toLowerCase()} proposal`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedProposal) return;
    setLoading(true);
    setError(null);

    try {
      await apiClient.agentpay.executeInvoice(selectedProposal.id);
      setSuccess("Payment executed successfully");
      setSelectedProposal(null);
      await loadProposals();
    } catch (err) {
      setError(err.message || "Failed to execute payment");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const policyData = {
      isEnabled: formData.get("isEnabled") === "on",
      requireHumanApproval: formData.get("requireHumanApproval") === "on",
      allowedCurrencies: ["USD", "INR"],
      maxInvoiceAgeDays: parseInt(formData.get("maxInvoiceAgeDays")) || 90,
      spendingLimits: [
        {
          currency: "USD",
          maxAmountMinor: formData.get("usdLimit") || "1000000",
          period: "PER_INVOICE",
        },
        {
          currency: "INR",
          maxAmountMinor: formData.get("inrLimit") || "80000000",
          period: "PER_INVOICE",
        },
      ],
      approvedSuppliers: formData.get("approvedSuppliers")
        ? formData
            .get("approvedSuppliers")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((name) => ({ name, normalizedName: name.toLowerCase() }))
        : [],
      blockedSuppliers: [],
    };

    try {
      if (policy) {
        await apiClient.agentpay.updatePolicy(policyData);
      } else {
        await apiClient.agentpay.createPolicy(policyData);
      }
      setSuccess("Policy saved successfully");
      setView("dashboard");
      await loadPolicy();
      await loadProposals();
    } catch (err) {
      setError(err.message || "Failed to save policy");
    } finally {
      setLoading(false);
    }
  };

  if (!auth) {
    return (
      <AuthGate
        title="AgentPay Autonomous Invoicing"
        description="Configure agentic approval policies, simulate invoice extraction, and review authorization proposals."
      />
    );
  }

  if (view === "policy") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              AgentPay Policy
            </h1>
            <p className="text-gray-500 mt-1">
              Configure spending limits, approved suppliers, and approval rules
            </p>
          </div>
          <Button onClick={() => setView("dashboard")}>
            <Inbox className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>AgentPay Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePolicy} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Enable AgentPay
                  </label>
                  <input
                    type="checkbox"
                    name="isEnabled"
                    defaultChecked={policy?.isEnabled ?? false}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Require Human Approval
                  </label>
                  <input
                    type="checkbox"
                    name="requireHumanApproval"
                    defaultChecked={policy?.requireHumanApproval ?? true}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Max Invoice Age (days)
                  </label>
                  <Input
                    name="maxInvoiceAgeDays"
                    type="number"
                    defaultValue={policy?.maxInvoiceAgeDays ?? 90}
                    min="1"
                    max="365"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Approved Suppliers (comma-separated)
                </label>
                <Input
                  name="approvedSuppliers"
                  placeholder="e.g., Acme Corp, Global Supplier Inc"
                  defaultValue={
                    policy?.approvedSuppliers?.map((s) => s.name).join(", ") ??
                    ""
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Only invoices from approved suppliers will be processed
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    USD Limit per Invoice (minor units)
                  </label>
                  <Input
                    name="usdLimit"
                    type="number"
                    defaultValue={String(
                      policy?.spendingLimits?.find((l) => l.currency === "USD")
                        ?.maxAmountMinor ?? 1000000,
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    INR Limit per Invoice (minor units)
                  </label>
                  <Input
                    name="inrLimit"
                    type="number"
                    defaultValue={String(
                      policy?.spendingLimits?.find((l) => l.currency === "INR")
                        ?.maxAmountMinor ?? 80000000,
                    )}
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Policy"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "submit") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Submit Invoice</h1>
            <p className="text-gray-500 mt-1">
              Upload or paste invoice text for AI-assisted extraction and review
            </p>
          </div>
          <Button onClick={() => setView("dashboard")}>
            <Inbox className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Invoice Submission</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitInvoice} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Invoice ID (Idempotency Key)
                </label>
                <Input
                  name="idempotencyKey"
                  placeholder="e.g., INV-2024-001"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Unique identifier to prevent duplicate submissions
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Invoice Text
                </label>
                <textarea
                  name="invoiceText"
                  rows={12}
                  className="w-full h-64 p-3 border border-gray-300 rounded-md bg-white font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  placeholder={`Example:
From: Acme Corporation
Invoice #: INV-2024-001
Amount: $1,250.00 USD
Date: 2024-01-15
Due: 2024-02-15
Payment Purpose: Office supplies and equipment`}
                  required
                />
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Processing..." : "Extract & Submit"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">
                  AI Extraction
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Automatically extracts supplier, amount, currency, and invoice
                number using deterministic parsing with optional LLM assistance.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">
                  Policy Check
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Validates against spending limits, approved suppliers, and
                duplicate detection before approval.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">
                  Human Approval
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Requires explicit human approval before payment execution. AI
                cannot bypass authorization.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AgentPay</h1>
          <p className="text-gray-500 mt-1">
            AI-assisted invoice payment authorization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setView("policy")}>
            <Shield className="h-4 w-4 mr-2" />
            Policy
          </Button>
          <Button onClick={() => setView("submit")}>
            <Plus className="h-4 w-4 mr-2" />
            Submit Invoice
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {proposals.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Invoice proposals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {proposals.filter((p) => p.status === "AWAITING_APPROVAL").length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Awaiting human review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Executed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {proposals.filter((p) => p.status === "EXECUTED").length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Payments executed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Invoice Proposals</CardTitle>
            <Button variant="outline" size="sm" onClick={loadProposals}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <Clock className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No proposals yet
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Submit your first invoice to get started
              </p>
              <Button onClick={() => setView("submit")} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Submit Invoice
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">Invoice ID</th>
                    <th className="pb-3 font-medium">Supplier</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Created</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {proposals.map((proposal) => (
                    <tr key={proposal.id} className="hover:bg-gray-50">
                      <td className="py-3 font-mono text-gray-600">
                        {proposal.invoiceId}
                      </td>
                      <td className="py-3 text-gray-900">
                        {proposal.extractedData?.supplierName ?? "—"}
                      </td>
                      <td className="py-3">
                        {formatMoney(
                          proposal.extractedData?.amountMinor,
                          proposal.extractedData?.currency,
                        )}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={STATUS_BADGE[proposal.status] ?? "default"}
                        >
                          {proposal.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(proposal.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedProposal(proposal)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {proposal.status === "AWAITING_APPROVAL" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProposal(proposal);
                              }}
                            >
                              Review
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

      {selectedProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Proposal Details</h2>
              <button
                onClick={() => setSelectedProposal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Invoice ID</p>
                  <p className="font-mono text-sm">
                    {selectedProposal.invoiceId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Status</p>
                  <Badge
                    variant={STATUS_BADGE[selectedProposal.status] ?? "default"}
                  >
                    {selectedProposal.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Supplier</p>
                  <p className="text-sm">
                    {selectedProposal.extractedData?.supplierName ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatMoney(
                      selectedProposal.extractedData?.amountMinor,
                      selectedProposal.extractedData?.currency,
                    )}
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Extracted Data</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">
                      Invoice Number
                    </p>
                    <p className="text-sm">
                      {selectedProposal.extractedData?.invoiceNumber ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Currency</p>
                    <p className="text-sm">
                      {selectedProposal.extractedData?.currency ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">
                      Confidence
                    </p>
                    <p className="text-sm">
                      {selectedProposal.confidence}%{" "}
                      {selectedProposal.extractionMethod}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">
                      Payment Purpose
                    </p>
                    <p className="text-sm">
                      {selectedProposal.extractedData?.paymentPurpose ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedProposal.status === "AWAITING_APPROVAL" && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Approval</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This proposal requires explicit human approval before
                    payment execution. AI cannot bypass this authorization.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="default"
                      onClick={() => handleDecide("APPROVE")}
                      disabled={loading}
                    >
                      Approve Payment
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDecide("REJECT")}
                      disabled={loading}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {selectedProposal.status === "APPROVED" && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Execute Payment</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Proposal has been approved. Execute to create a payment
                    through the idempotent payment engine.
                  </p>
                  <Button
                    variant="default"
                    onClick={handleExecute}
                    disabled={loading}
                  >
                    Execute Payment
                  </Button>
                </div>
              )}

              {selectedProposal.approval && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Approval History</h3>
                  <div className="space-y-2">
                    {selectedProposal.approval.approvedAt && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                        <span className="text-sm text-green-700 font-medium">
                          Approved
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(
                            selectedProposal.approval.approvedAt,
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedProposal.approval.rejectedAt && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-red-50">
                        <span className="text-sm text-red-700 font-medium">
                          Rejected
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(
                            selectedProposal.approval.rejectedAt,
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentPay;

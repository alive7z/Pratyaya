import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Inbox,
  Shield,
  FileText,
  CheckCircle2,
  Plus,
  RefreshCw,
  ArrowLeft,
  Eye,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/Dialog.jsx";

const STATUS_BADGE = {
  PENDING_EXTRACTION: "secondary",
  EXTRACTED: "info",
  POLICY_CHECK_FAILED: "destructive",
  RISK_CHECK_FAILED: "destructive",
  AWAITING_APPROVAL: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  EXECUTED: "success",
  EXPIRED: "secondary",
};

function getPayload(response) {
  return response?.data?.data ?? response?.data ?? response;
}

function getInvoices(response) {
  const data = getPayload(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.invoices)) return data.invoices;
  return [];
}

function money(amount, currency) {
  if (amount == null || !currency) return "—";
  return formatMoney(String(amount), currency);
}

function date(value) {
  if (!value) return "—";
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? "—" : result.toLocaleString();
}

function Stat({ title, value, icon: Icon }) {
  return (
    <Card>
      <CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 p-5 text-center">
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 wrap-break-word text-sm font-medium">
        {children ?? "—"}
      </div>
    </div>
  );
}

export function AgentPay() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState("dashboard");
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const merchantId = auth?.merchantId ?? null;

  const proposalsQuery = useQuery({
    queryKey: ["agentpay-invoices", merchantId],
    queryFn: () => apiClient.agentpay.listInvoices({ limit: 50 }),
    enabled: Boolean(auth),
    refetchInterval: 15000,
  });

  const policyQuery = useQuery({
    queryKey: ["agentpay-policy", merchantId],
    queryFn: () => apiClient.agentpay.getPolicy(),
    enabled: Boolean(auth),
  });

  const proposals = getInvoices(proposalsQuery.data);
  const policyPayload = getPayload(policyQuery.data);
  const policy = policyPayload?.policy ?? policyPayload ?? null;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["agentpay-invoices", merchantId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["agentpay-policy", merchantId],
      }),
    ]);
  };

  const mutation = useMutation({
    mutationFn: async ({ action, data, id }) => {
      if (action === "submit") return apiClient.agentpay.submitInvoice(data);
      if (action === "policy") {
        return policy
          ? apiClient.agentpay.updatePolicy(data)
          : apiClient.agentpay.createPolicy(data);
      }
      if (action === "approve" || action === "reject") {
        return apiClient.agentpay.decideInvoice(id, {
          decision: action === "approve" ? "APPROVE" : "REJECT",
          reason: action === "reject" ? "Manual review rejection" : undefined,
        });
      }
      if (action === "execute") return apiClient.agentpay.executeInvoice(id);
      throw new Error("Unsupported action.");
    },
    onSuccess: async (_, variables) => {
      setError("");
      setSuccess(
        {
          submit: "Invoice submitted successfully.",
          policy: "Policy saved successfully.",
          approve: "Invoice approved successfully.",
          reject: "Invoice rejected successfully.",
          execute: "Payment execution request completed.",
        }[variables.action],
      );

      if (variables.action !== "submit") setSelectedProposal(null);

      if (variables.action === "policy" || variables.action === "submit") {
        setView("dashboard");
      }

      await refresh();
    },
    onError: (err) => setError(err?.message ?? "Operation failed."),
  });

  const submitInvoice = (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const data = new FormData(event.currentTarget);
    const invoiceText = String(data.get("invoiceText") ?? "").trim();
    const idempotencyKey = String(data.get("idempotencyKey") ?? "").trim();

    if (!invoiceText || !idempotencyKey) {
      setError("Invoice text and invoice ID are required.");
      return;
    }

    mutation.mutate({
      action: "submit",
      data: { invoiceText, idempotencyKey },
    });
  };

  const savePolicy = (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const data = new FormData(event.currentTarget);
    const suppliers = String(data.get("approvedSuppliers") ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    const maxInvoiceAgeDays = Number(data.get("maxInvoiceAgeDays"));
    const usdLimit = String(data.get("usdLimit") ?? "");
    const inrLimit = String(data.get("inrLimit") ?? "");

    if (
      !Number.isInteger(maxInvoiceAgeDays) ||
      maxInvoiceAgeDays < 1 ||
      maxInvoiceAgeDays > 365 ||
      !/^[1-9]\d*$/.test(usdLimit) ||
      !/^[1-9]\d*$/.test(inrLimit)
    ) {
      setError("Enter valid invoice limits and an age between 1 and 365 days.");
      return;
    }

    mutation.mutate({
      action: "policy",
      data: {
        isEnabled: data.get("isEnabled") === "on",
        requireHumanApproval: data.get("requireHumanApproval") === "on",
        allowedCurrencies: ["USD", "INR"],
        maxInvoiceAgeDays,
        spendingLimits: [
          { currency: "USD", maxAmountMinor: usdLimit, period: "PER_INVOICE" },
          { currency: "INR", maxAmountMinor: inrLimit, period: "PER_INVOICE" },
        ],
        approvedSuppliers: suppliers.map((name) => ({
          name,
          normalizedName: name.toLowerCase(),
        })),
        blockedSuppliers: policy?.blockedSuppliers ?? [],
      },
    });
  };

  const changeView = (next) => {
    setError("");
    setSuccess("");
    setView(next);
  };

  if (!auth) {
    return (
      <AuthGate
        title="AgentPay Autonomous Invoicing"
        description="Configure approval policies, submit synthetic invoices, and review payment proposals."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {view === "policy"
              ? "AgentPay Policy"
              : view === "submit"
                ? "Submit Invoice"
                : "AgentPay"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {view === "policy"
              ? "Configure suppliers, limits, and approval requirements."
              : view === "submit"
                ? "Submit invoice text for extraction and policy evaluation."
                : "AI-assisted invoice processing and human payment authorization."}
          </p>
        </div>

        {view === "dashboard" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => changeView("policy")}>
              <Shield className="h-4 w-4" />
              Policy
            </Button>
            <Button onClick={() => changeView("submit")}>
              <Plus className="h-4 w-4" />
              Submit Invoice
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => changeView("dashboard")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          {success}
        </div>
      )}

      {view === "policy" && (
        <Card>
          <CardHeader>
            <CardTitle>AgentPay Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {policyQuery.isPending ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Loading policy...
              </p>
            ) : policyQuery.isError ? (
              <p role="alert" className="text-sm text-red-600">
                {policyQuery.error.message}
              </p>
            ) : (
              <form
                key={JSON.stringify(policy)}
                onSubmit={savePolicy}
                className="space-y-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    [
                      "isEnabled",
                      "Enable AgentPay",
                      policy?.isEnabled ?? false,
                    ],
                    [
                      "requireHumanApproval",
                      "Require Human Approval",
                      policy?.requireHumanApproval ?? true,
                    ],
                  ].map(([name, label, checked]) => (
                    <label
                      key={name}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
                    >
                      <input
                        type="checkbox"
                        name={name}
                        defaultChecked={checked}
                        className="h-4 w-4 accent-blue-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="invoice-age"
                      className="text-sm font-medium"
                    >
                      Max Invoice Age (days)
                    </label>
                    <Input
                      id="invoice-age"
                      name="maxInvoiceAgeDays"
                      type="number"
                      min="1"
                      max="365"
                      required
                      defaultValue={policy?.maxInvoiceAgeDays ?? 90}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="suppliers" className="text-sm font-medium">
                    Approved Suppliers
                  </label>
                  <Input
                    id="suppliers"
                    name="approvedSuppliers"
                    placeholder="Acme Corp, Global Supplier"
                    defaultValue={
                      policy?.approvedSuppliers
                        ?.map((s) => s.name)
                        .join(", ") ?? ""
                    }
                  />
                  <p className="text-xs text-slate-500">
                    Separate supplier names with commas.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["USD", "usdLimit", "1000000"],
                    ["INR", "inrLimit", "80000000"],
                  ].map(([currency, name, fallback]) => (
                    <div key={currency} className="space-y-2">
                      <label htmlFor={name} className="text-sm font-medium">
                        {currency} Limit (minor units)
                      </label>
                      <Input
                        id={name}
                        name={name}
                        inputMode="numeric"
                        required
                        defaultValue={String(
                          policy?.spendingLimits?.find(
                            (item) => item.currency === currency,
                          )?.maxAmountMinor ?? fallback,
                        )}
                      />
                    </div>
                  ))}
                </div>

                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : "Save Policy"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {view === "submit" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Invoice Submission</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitInvoice} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="invoice-id" className="text-sm font-medium">
                    Invoice ID / Idempotency Key
                  </label>
                  <Input
                    id="invoice-id"
                    name="idempotencyKey"
                    required
                    placeholder="INV-2026-001"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="invoice-text" className="text-sm font-medium">
                    Invoice Text
                  </label>
                  <textarea
                    id="invoice-text"
                    name="invoiceText"
                    rows={10}
                    required
                    placeholder={
                      "Supplier: Acme Corporation\nInvoice #: INV-2026-001\nAmount: 1250.00 USD\nDate: 2026-10-24\nPayment Purpose: Office equipment"
                    }
                    className="w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
                <Button type="submit" disabled={mutation.isPending}>
                  <Bot className="h-4 w-4" />
                  {mutation.isPending ? "Processing..." : "Extract & Submit"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [
                Bot,
                "Invoice Extraction",
                "Extract supplier, currency, amount, and invoice information.",
              ],
              [
                Shield,
                "Policy Validation",
                "Evaluate configured limits and supplier restrictions.",
              ],
              [
                CheckCircle2,
                "Human Approval",
                "Review and authorize payments before execution when required.",
              ],
            ].map(([Icon, title, description]) => (
              <Card key={title}>
                <CardContent className="space-y-2 pt-5">
                  <Icon className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {view === "dashboard" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              title="Total Proposals"
              value={proposalsQuery.isPending ? "—" : proposals.length}
              icon={FileText}
            />
            <Stat
              title="Pending Approval"
              value={
                proposalsQuery.isPending
                  ? "—"
                  : proposals.filter((p) => p.status === "AWAITING_APPROVAL")
                      .length
              }
              icon={Inbox}
            />
            <Stat
              title="Executed"
              value={
                proposalsQuery.isPending
                  ? "—"
                  : proposals.filter((p) => p.status === "EXECUTED").length
              }
              icon={CheckCircle2}
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Invoice Proposals</CardTitle>
              <Button
                variant="outline"
                size="sm"
                disabled={proposalsQuery.isFetching}
                onClick={() => proposalsQuery.refetch()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${proposalsQuery.isFetching ? "animate-spin" : ""}`}
                />
              </Button>
            </CardHeader>
            <CardContent>
              {proposalsQuery.isPending ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Loading invoices...
                </p>
              ) : proposalsQuery.isError ? (
                <p
                  role="alert"
                  className="py-6 text-center text-sm text-red-600"
                >
                  {proposalsQuery.error.message}
                </p>
              ) : proposals.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="mx-auto h-9 w-9 text-slate-400" />
                  <p className="mt-3 text-sm font-medium">
                    No invoice proposals yet
                  </p>
                  <Button className="mt-4" onClick={() => changeView("submit")}>
                    <Plus className="h-4 w-4" />
                    Submit Invoice
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                      <tr>
                        {[
                          "Invoice ID",
                          "Supplier",
                          "Amount",
                          "Status",
                          "Created",
                          "Action",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="whitespace-nowrap px-3 py-3 font-medium"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {proposals.map((proposal) => (
                        <tr
                          key={proposal.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          <td className="px-3 py-3 font-mono text-xs">
                            {proposal.invoiceId}
                          </td>
                          <td className="px-3 py-3">
                            {proposal.extractedData?.supplierName ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {money(
                              proposal.extractedData?.amountMinor,
                              proposal.extractedData?.currency,
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant={
                                STATUS_BADGE[proposal.status] ?? "secondary"
                              }
                            >
                              {proposal.status?.replaceAll("_", " ") ??
                                "Unknown"}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                            {date(proposal.createdAt)}
                          </td>
                          <td className="px-3 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="View invoice"
                              onClick={() => {
                                setError("");
                                setSelectedProposal(proposal);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
        open={Boolean(selectedProposal)}
        onOpenChange={(open) =>
          !open && !mutation.isPending && setSelectedProposal(null)
        }
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Proposal</DialogTitle>
            <DialogDescription>{selectedProposal?.invoiceId}</DialogDescription>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-900 sm:grid-cols-2">
                <Field label="Supplier">
                  {selectedProposal.extractedData?.supplierName}
                </Field>
                <Field label="Amount">
                  {money(
                    selectedProposal.extractedData?.amountMinor,
                    selectedProposal.extractedData?.currency,
                  )}
                </Field>
                <Field label="Invoice Number">
                  {selectedProposal.extractedData?.invoiceNumber}
                </Field>
                <Field label="Status">
                  <Badge
                    variant={
                      STATUS_BADGE[selectedProposal.status] ?? "secondary"
                    }
                  >
                    {selectedProposal.status?.replaceAll("_", " ")}
                  </Badge>
                </Field>
                <Field label="Payment Purpose">
                  {selectedProposal.extractedData?.paymentPurpose}
                </Field>
                <Field label="Confidence">
                  {selectedProposal.confidence != null
                    ? `${selectedProposal.confidence}%`
                    : "—"}
                </Field>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              {selectedProposal.status === "AWAITING_APPROVAL" && (
                <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <p className="text-sm text-slate-500">
                    Review the extracted invoice information before authorizing
                    payment.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          action: "approve",
                          id: selectedProposal.id,
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          action: "reject",
                          id: selectedProposal.id,
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {selectedProposal.status === "APPROVED" && (
                <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <p className="text-sm text-slate-500">
                    This proposal is approved and ready for payment execution.
                  </p>
                  <Button
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        action: "execute",
                        id: selectedProposal.id,
                      })
                    }
                  >
                    Execute Payment
                  </Button>
                </div>
              )}

              {selectedProposal.approval && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                  <h3 className="mb-3 text-sm font-semibold">
                    Approval History
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedProposal.approval.approvedAt && (
                      <Field label="Approved">
                        {date(selectedProposal.approval.approvedAt)}
                      </Field>
                    )}
                    {selectedProposal.approval.rejectedAt && (
                      <Field label="Rejected">
                        {date(selectedProposal.approval.rejectedAt)}
                      </Field>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AgentPay;

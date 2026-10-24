import mongoose from "mongoose";
import { AgentProposal } from "./agent-proposal.model.js";
import { AgentPolicy } from "./agent-policy.model.js";
import { AgentApproval } from "./agent-approval.model.js";
import { AgentAuditEvent } from "./agent-audit-event.model.js";
import { runInTransaction } from "../../lib/transaction.js";
import { AppError } from "../../lib/errors.js";
import { recordAudit } from "../audit/audit.service.js";

const LLM_PROVIDER_URL = process.env.AGENTPAY_LLM_URL;
const LLM_API_KEY = process.env.AGENTPAY_LLM_API_KEY;

function now() {
  return new Date();
}

function normalizeText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractWithRegex(text) {
  const normalized = normalizeText(text);

  const supplierMatch = normalized.match(
    /(?:from|supplier|vendor|payee|biller)\s*[:|-]?\s*([^\n\r]{1,100})/i,
  );
  const amountMatch = normalized.match(
    /(?:amount|total|balance due|payable)\s*[:|-]?\s*[$₹]?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  const invoiceNumberMatch = normalized.match(
    /(?:invoice|inv|bill)\s*(?:#|no|number)?\s*[:|-]?\s*([A-Za-z0-9._\-/]{1,50})/i,
  );
  const currencyMatch = normalized.match(/(USD|INR|[$₹])/i);
  const dateMatch = normalized.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);

  let amountMinor = null;
  if (amountMatch) {
    const amountStr = amountMatch[1].replace(/,/g, "");
    const amountNum = parseFloat(amountStr);
    if (!isNaN(amountNum) && amountNum > 0) {
      amountMinor = BigInt(Math.round(amountNum * 100));
    }
  }

  let currency = "USD";
  if (currencyMatch) {
    const c = currencyMatch[0].toUpperCase();
    if (c === "$") currency = "USD";
    else if (c === "₹") currency = "INR";
    else if (c === "USD" || c === "INR") currency = c;
  }

  return {
    supplierName: supplierMatch ? supplierMatch[1].trim() : undefined,
    supplierNormalized: supplierMatch
      ? normalizeText(supplierMatch[1])
      : undefined,
    amountMinor,
    currency,
    invoiceNumber: invoiceNumberMatch
      ? invoiceNumberMatch[1].trim()
      : undefined,
    invoiceDate: dateMatch ? new Date(dateMatch[1]) : undefined,
    confidence: amountMinor && supplierMatch ? 75 : 40,
  };
}

async function extractWithLLM(text) {
  if (!LLM_PROVIDER_URL || !LLM_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${LLM_PROVIDER_URL}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({ invoiceText: text }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`LLM provider returned ${response.status}`);
    }

    const data = await response.json();

    return {
      supplierName: data.supplierName,
      supplierNormalized: normalizeText(data.supplierName),
      amountMinor: data.amountMinor ? BigInt(data.amountMinor) : null,
      currency: data.currency ?? "USD",
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
      confidence: data.confidence ?? 90,
    };
  } catch {
    return null;
  }
}

export async function createPolicy({
  merchantId,
  policy,
  req,
  config,
  session,
}) {
  const existing = await AgentPolicy.findOne({ merchantId })
    .session(session)
    .lean();
  if (existing) {
    throw new AppError(
      409,
      "POLICY_ALREADY_EXISTS",
      "AgentPay policy already exists for this merchant",
    );
  }

  const [doc] = await AgentPolicy.create([{ merchantId, ...policy }], {
    session,
  });

  await recordAudit(
    {
      action: "agentpay.policy.created",
      actorUserId: req.auth?.user?._id ?? req.auth?.userId,
      actorRole: req.auth?.role,
      merchantId,
      resourceType: "agentpay.policy",
      resourceId: doc._id,
      req,
      isDemo: Boolean(req.auth?.isDemo),
      metadata: {
        isEnabled: policy.isEnabled,
        requireHumanApproval: policy.requireHumanApproval,
      },
    },
    { session, secret: config.auth.jwtSecret },
  );

  return doc;
}

export async function getPolicy({ auth }) {
  const policy = await AgentPolicy.findOne({
    merchantId: auth.merchantId,
  }).lean();
  if (!policy) {
    throw new AppError(
      404,
      "POLICY_NOT_FOUND",
      "AgentPay policy not found for this merchant",
    );
  }
  return policy;
}

export async function updatePolicy({ auth, policy, req, config, session }) {
  const doc = await AgentPolicy.findOneAndUpdate(
    { merchantId: auth.merchantId },
    { $set: { ...policy, version: (policy.version ?? 0) + 1 } },
    { returnDocument: "after", session },
  ).lean();

  if (!doc) {
    throw new AppError(
      404,
      "POLICY_NOT_FOUND",
      "AgentPay policy not found for this merchant",
    );
  }

  await recordAudit(
    {
      action: "agentpay.policy.updated",
      actorUserId: auth.user?._id ?? auth.userId,
      actorRole: auth.role,
      merchantId: auth.merchantId,
      resourceType: "agentpay.policy",
      resourceId: doc._id,
      req,
      isDemo: Boolean(auth.isDemo),
      metadata: { updatedFields: Object.keys(policy) },
    },
    { session, secret: config.auth.jwtSecret },
  );

  return doc;
}

export async function submitInvoice({ auth, body, req, config }) {
  const { invoiceText, idempotencyKey } = body;
  const merchantId = auth.merchantId;

  return runInTransaction(async (session) => {
    const existingProposal = await AgentProposal.findOne({
      merchantId,
      invoiceId: idempotencyKey,
    })
      .session(session)
      .lean();
    if (existingProposal) {
      throw new AppError(
        409,
        "DUPLICATE_INVOICE",
        "An invoice with this ID has already been submitted",
      );
    }

    const extracted = await extractWithLLM(invoiceText);
    const extractionMethod = extracted ? "LLM" : "LOCAL";
    const finalExtracted = extracted || extractWithRegex(invoiceText);

    const [proposal] = await AgentProposal.create(
      [
        {
          merchantId,
          invoiceId: idempotencyKey,
          invoiceText,
          extractedData: {
            supplierName: finalExtracted.supplierName,
            supplierNormalized: finalExtracted.supplierNormalized,
            amountMinor: finalExtracted.amountMinor,
            currency: finalExtracted.currency,
            invoiceNumber: finalExtracted.invoiceNumber,
            paymentPurpose: finalExtracted.paymentPurpose,
            invoiceDate: finalExtracted.invoiceDate,
            lineItems: finalExtracted.lineItems,
          },
          confidence: finalExtracted.confidence,
          extractionMethod,
          status: "EXTRACTED",
          idempotencyKey,
          isDemo: Boolean(auth.isDemo),
        },
      ],
      { session },
    );

    await AgentAuditEvent.create(
      [
        {
          merchantId,
          proposalId: proposal._id,
          action: "PROPOSAL_CREATED",
          actorUserId: auth.user?._id ?? auth.userId,
          actorRole: auth.role,
          metadata: {
            extractionMethod,
            confidence: finalExtracted.confidence,
            supplier: finalExtracted.supplierName,
            amountMinor: String(finalExtracted.amountMinor),
            currency: finalExtracted.currency,
          },
          isDemo: Boolean(auth.isDemo),
        },
      ],
      { session },
    );

    const policy = await AgentPolicy.findOne({ merchantId })
      .session(session)
      .lean();
    if (!policy || !policy.isEnabled) {
      await AgentProposal.findOneAndUpdate(
        { _id: proposal._id },
        { $set: { status: "POLICY_CHECK_FAILED" } },
        { session },
      );
      throw new AppError(
        403,
        "AGENTPAY_DISABLED",
        "AgentPay is not enabled for this merchant",
      );
    }

    const policyResult = validatePolicy(policy, finalExtracted);
    if (!policyResult.passed) {
      await AgentProposal.findOneAndUpdate(
        { _id: proposal._id },
        {
          $set: {
            status: "POLICY_CHECK_FAILED",
            policyCheck: { passed: false, reasons: policyResult.reasons },
          },
        },
        { session },
      );
      await AgentAuditEvent.create(
        [
          {
            merchantId,
            proposalId: proposal._id,
            action: "POLICY_CHECK_FAILED",
            actorUserId: auth.user?._id ?? auth.userId,
            actorRole: auth.role,
            metadata: { reasons: policyResult.reasons },
            outcome: "FAILURE",
            isDemo: Boolean(auth.isDemo),
          },
        ],
        { session },
      );

      throw new AppError(
        403,
        "POLICY_CHECK_FAILED",
        "Invoice failed policy validation",
        { reasons: policyResult.reasons },
      );
    }

    await AgentProposal.findOneAndUpdate(
      { _id: proposal._id },
      { $set: { status: "AWAITING_APPROVAL", policyCheck: { passed: true } } },
      { session },
    );

    await AgentAuditEvent.create(
      [
        {
          merchantId,
          proposalId: proposal._id,
          action: "POLICY_CHECK_PASSED",
          actorUserId: auth.user?._id ?? auth.userId,
          actorRole: auth.role,
          metadata: policyResult,
          isDemo: Boolean(auth.isDemo),
        },
      ],
      { session },
    );

    await recordAudit(
      {
        action: "agentpay.proposal.created",
        actorUserId: auth.user?._id ?? auth.userId,
        actorRole: auth.role,
        merchantId,
        resourceType: "agentpay.proposal",
        resourceId: proposal._id,
        req,
        isDemo: Boolean(auth.isDemo),
        metadata: {
          invoiceId: idempotencyKey,
          supplier: finalExtracted.supplierName,
          amountMinor: String(finalExtracted.amountMinor),
          currency: finalExtracted.currency,
          extractionMethod,
        },
      },
      { session, secret: config.auth.jwtSecret },
    );

    return {
      proposal: toProposalDto(proposal),
      extraction: finalExtracted,
      policyResult,
      requiresHumanApproval: policy.requireHumanApproval,
    };
  });
}

function validatePolicy(policy, extracted) {
  const reasons = [];

  if (!extracted.amountMinor || extracted.amountMinor <= 0n) {
    reasons.push("Could not extract a valid invoice amount");
    return { passed: false, reasons };
  }

  if (!extracted.supplierName) {
    reasons.push("Could not extract supplier name");
    return { passed: false, reasons };
  }

  if (policy.blockedSuppliers && policy.blockedSuppliers.length > 0) {
    const normalized = normalizeText(extracted.supplierName);
    const blocked = policy.blockedSuppliers.find(
      (b) => normalizeText(b.name) === normalized,
    );
    if (blocked) {
      reasons.push(`Supplier "${blocked.name}" is blocked: ${blocked.reason}`);
      return { passed: false, reasons };
    }
  }

  if (policy.approvedSuppliers && policy.approvedSuppliers.length > 0) {
    const normalized = normalizeText(extracted.supplierName);
    const approved = policy.approvedSuppliers.find(
      (s) =>
        normalizeText(s.name) === normalized ||
        normalizeText(s.normalizedName) === normalized,
    );
    if (!approved) {
      reasons.push(
        `Supplier "${extracted.supplierName}" is not in the approved supplier list`,
      );
      return { passed: false, reasons };
    }
  }

  if (
    policy.allowedCurrencies &&
    !policy.allowedCurrencies.includes(extracted.currency)
  ) {
    reasons.push(`Currency ${extracted.currency} is not allowed`);
    return { passed: false, reasons };
  }

  const spendingLimitCheck = { passed: true, reasons: [] };
  for (const limit of policy.spendingLimits || []) {
    if (
      limit.period === "PER_INVOICE" &&
      extracted.amountMinor > limit.maxAmountMinor
    ) {
      spendingLimitCheck.passed = false;
      spendingLimitCheck.reasons.push(
        `Amount exceeds per-invoice limit of ${limit.maxAmountMinor} ${limit.currency} minor units`,
      );
    }
  }
  if (!spendingLimitCheck.passed) {
    reasons.push(...spendingLimitCheck.reasons);
    return { passed: false, reasons };
  }

  if (extracted.invoiceDate) {
    const ageDays =
      (now() - extracted.invoiceDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > policy.maxInvoiceAgeDays) {
      reasons.push(
        `Invoice is ${Math.floor(ageDays)} days old, exceeding max age of ${policy.maxInvoiceAgeDays} days`,
      );
      return { passed: false, reasons };
    }
  }

  return {
    passed: true,
    reasons: [],
    spendingLimitCheck: { passed: true },
    approvedSupplierCheck: { passed: true },
    duplicateCheck: { passed: true },
  };
}

export async function getProposal({ auth, proposalId }) {
  const proposal = await AgentProposal.findOne({
    _id: proposalId,
    merchantId: auth.merchantId,
  }).lean();
  if (!proposal) {
    throw new AppError(404, "PROPOSAL_NOT_FOUND", "Proposal not found");
  }
  return toProposalDto(proposal);
}

export async function listProposals({ auth, query }) {
  const filter = { merchantId: auth.merchantId };
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const limit = Math.min(query.limit ?? 20, 100);
  const cursor = query.cursor ? { _id: { $lt: query.cursor } } : {};
  const filterWithCursor = { ...filter, ...cursor };

  const proposals = await AgentProposal.find(filterWithCursor)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = proposals.length > limit;
  const items = hasMore ? proposals.slice(0, -1) : proposals;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

  return {
    items: items.map(toProposalDto),
    nextCursor,
    hasMore,
  };
}

export async function decideProposal({
  auth,
  proposalId,
  decision,
  reason,
  req,
  config,
}) {
  return runInTransaction(async (session) => {
    const proposal = await AgentProposal.findOne({
      _id: proposalId,
      merchantId: auth.merchantId,
    }).session(session);
    if (!proposal) {
      throw new AppError(404, "PROPOSAL_NOT_FOUND", "Proposal not found");
    }

    if (proposal.status !== "AWAITING_APPROVAL") {
      throw new AppError(
        409,
        "INVALID_PROPOSAL_STATE",
        `Proposal is in ${proposal.status} state, cannot approve/reject`,
      );
    }

    if (decision === "REJECT") {
      proposal.status = "REJECTED";
      proposal.approval = {
        rejectedBy: auth.user?._id ?? auth.userId,
        rejectedAt: now(),
        rejectionReason: reason,
      };

      await proposal.save({ session });

      await AgentApproval.create(
        [
          {
            merchantId: auth.merchantId,
            proposalId: proposal._id,
            action: "REJECT",
            decidedBy: auth.user?._id ?? auth.userId,
            reason,
            isDemo: Boolean(auth.isDemo),
          },
        ],
        { session },
      );

      await AgentAuditEvent.create(
        [
          {
            merchantId: auth.merchantId,
            proposalId: proposal._id,
            action: "REJECTED",
            actorUserId: auth.user?._id ?? auth.userId,
            actorRole: auth.role,
            metadata: { reason },
            isDemo: Boolean(auth.isDemo),
          },
        ],
        { session },
      );

      await recordAudit(
        {
          action: "agentpay.proposal.rejected",
          actorUserId: auth.user?._id ?? auth.userId,
          actorRole: auth.role,
          merchantId: auth.merchantId,
          resourceType: "agentpay.proposal",
          resourceId: proposal._id,
          req,
          isDemo: Boolean(auth.isDemo),
          metadata: { reason },
        },
        { session, secret: config.auth.jwtSecret },
      );

      return { proposal: toProposalDto(proposal) };
    }

    if (decision === "APPROVE") {
      proposal.status = "APPROVED";
      proposal.approval = {
        approvedBy: auth.user?._id ?? auth.userId,
        approvedAt: now(),
      };

      await proposal.save({ session });

      await AgentApproval.create(
        [
          {
            merchantId: auth.merchantId,
            proposalId: proposal._id,
            action: "APPROVE",
            decidedBy: auth.user?._id ?? auth.userId,
            reason,
            metadata: {
              originalAmountMinor: String(proposal.extractedData.amountMinor),
              approvedAmountMinor: String(proposal.extractedData.amountMinor),
              originalSupplier: proposal.extractedData.supplierName,
              approvedSupplier: proposal.extractedData.supplierName,
            },
            isDemo: Boolean(auth.isDemo),
          },
        ],
        { session },
      );

      await AgentAuditEvent.create(
        [
          {
            merchantId: auth.merchantId,
            proposalId: proposal._id,
            action: "APPROVED",
            actorUserId: auth.user?._id ?? auth.userId,
            actorRole: auth.role,
            metadata: {
              amountMinor: String(proposal.extractedData.amountMinor),
              supplier: proposal.extractedData.supplierName,
            },
            isDemo: Boolean(auth.isDemo),
          },
        ],
        { session },
      );

      await recordAudit(
        {
          action: "agentpay.proposal.approved",
          actorUserId: auth.user?._id ?? auth.userId,
          actorRole: auth.role,
          merchantId: auth.merchantId,
          resourceType: "agentpay.proposal",
          resourceId: proposal._id,
          req,
          isDemo: Boolean(auth.isDemo),
          metadata: {
            amountMinor: String(proposal.extractedData.amountMinor),
            supplier: proposal.extractedData.supplierName,
          },
        },
        { session, secret: config.auth.jwtSecret },
      );

      return { proposal: toProposalDto(proposal) };
    }

    throw new AppError(
      400,
      "INVALID_DECISION",
      "Decision must be APPROVE or REJECT",
    );
  });
}

export async function executeProposal({
  auth,
  proposalId,
  idempotencyKey,
  req,
  config,
}) {
  return runInTransaction(async (session) => {
    const proposal = await AgentProposal.findOne({
      _id: proposalId,
      merchantId: auth.merchantId,
    }).session(session);
    if (!proposal) {
      throw new AppError(404, "PROPOSAL_NOT_FOUND", "Proposal not found");
    }

    if (proposal.status !== "APPROVED") {
      throw new AppError(
        409,
        "INVALID_PROPOSAL_STATE",
        `Proposal is in ${proposal.status} state, must be APPROVED before execution`,
      );
    }

    if (proposal.execution && proposal.execution.paymentId) {
      throw new AppError(
        409,
        "ALREADY_EXECUTED",
        "Proposal has already been executed",
      );
    }

    const paymentBody = {
      amountMinor: String(proposal.extractedData.amountMinor),
      currency: proposal.extractedData.currency,
      description: `AgentPay: ${proposal.extractedData.supplierName} - Invoice #${proposal.extractedData.invoiceNumber}`,
      customerReference: proposal.extractedData.invoiceNumber,
      merchantReference: proposal.invoiceId,
      metadata: {
        agentpayProposalId: String(proposal._id),
        source: "agentpay",
      },
    };

    const { createPayment } = await import("../payments/payment.service.js");
    const paymentResult = await createPayment({
      auth,
      body: paymentBody,
      req: {
        ...req,
        headers: { ...req.headers, "Idempotency-Key": idempotencyKey },
      },
    });

    proposal.status = "EXECUTED";
    proposal.execution = {
      paymentId: new mongoose.Types.ObjectId(paymentResult.payment.id),
      executedAt: now(),
      executedBy: auth.user?._id ?? auth.userId,
    };

    await proposal.save({ session });

    await AgentAuditEvent.create(
      [
        {
          merchantId: auth.merchantId,
          proposalId: proposal._id,
          action: "EXECUTION_SUCCEEDED",
          actorUserId: auth.user?._id ?? auth.userId,
          actorRole: auth.role,
          metadata: {
            paymentId: paymentResult.payment.id,
            amountMinor: paymentBody.amountMinor,
            currency: paymentBody.currency,
          },
          isDemo: Boolean(auth.isDemo),
        },
      ],
      { session },
    );

    await recordAudit(
      {
        action: "agentpay.proposal.executed",
        actorUserId: auth.user?._id ?? auth.userId,
        actorRole: auth.role,
        merchantId: auth.merchantId,
        resourceType: "agentpay.proposal",
        resourceId: proposal._id,
        req,
        isDemo: Boolean(auth.isDemo),
        metadata: { paymentId: paymentResult.payment.id },
      },
      { session, secret: config.auth.jwtSecret },
    );

    return {
      proposal: toProposalDto(proposal),
      payment: paymentResult.payment,
    };
  });
}

function toProposalDto(proposal) {
  return {
    id: String(proposal._id),
    invoiceId: proposal.invoiceId,
    invoiceText: proposal.invoiceText,
    extractedData: {
      supplierName: proposal.extractedData.supplierName,
      supplierNormalized: proposal.extractedData.supplierNormalized,
      amountMinor: proposal.extractedData.amountMinor
        ? String(proposal.extractedData.amountMinor)
        : null,
      currency: proposal.extractedData.currency,
      invoiceNumber: proposal.extractedData.invoiceNumber,
      paymentPurpose: proposal.extractedData.paymentPurpose,
      invoiceDate: proposal.extractedData.invoiceDate,
      lineItems: proposal.extractedData.lineItems,
    },
    confidence: proposal.confidence,
    extractionMethod: proposal.extractionMethod,
    status: proposal.status,
    policyCheck: proposal.policyCheck,
    riskCheck: proposal.riskCheck,
    approval: proposal.approval
      ? {
          approvedBy: proposal.approval.approvedBy
            ? String(proposal.approval.approvedBy)
            : null,
          approvedAt: proposal.approval.approvedAt,
          rejectedBy: proposal.approval.rejectedBy
            ? String(proposal.approval.rejectedBy)
            : null,
          rejectedAt: proposal.approval.rejectedAt,
          rejectionReason: proposal.approval.rejectionReason,
        }
      : null,
    execution: proposal.execution
      ? {
          paymentId: proposal.execution.paymentId
            ? String(proposal.execution.paymentId)
            : null,
          executedAt: proposal.execution.executedAt,
          executedBy: proposal.execution.executedBy
            ? String(proposal.execution.executedBy)
            : null,
          executionError: proposal.execution.executionError,
        }
      : null,
    idempotencyKey: proposal.idempotencyKey,
    isDemo: proposal.isDemo,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  };
}

export const agentpayService = {
  createPolicy,
  getPolicy,
  updatePolicy,
  submitInvoice,
  getProposal,
  listProposals,
  decideProposal,
  executeProposal,
};

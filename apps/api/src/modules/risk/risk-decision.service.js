import { RiskDecision } from "./risk-decision.model.js";
import { RiskAlert } from "./risk-alert.model.js";
import { RISK_DECISION_SOURCE } from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { runInTransaction } from "../../lib/transaction.js";

async function evaluateAndRecord(
  merchantId,
  paymentId,
  paymentData,
  _source = "AUTOMATED",
) {
  const engine = (await import("./risk-engine.service.js")).riskEngine;
  const result = await engine.evaluatePayment(merchantId, paymentData);

  return runInTransaction(async (session) => {
    const decision = await RiskDecision.create(
      [
        {
          merchantId,
          paymentId,
          decision: result.decision,
          score: result.score,
          level: result.level,
          ruleCodes: result.triggeredRules.map((r) => r.ruleCode),
          explanation: result.explanation,
          source: RISK_DECISION_SOURCE.RULE_ENGINE,
        },
      ],
      { session },
    );

    if (
      result.decision === "BLOCK" ||
      result.level === "CRITICAL" ||
      result.level === "HIGH"
    ) {
      await RiskAlert.create(
        [
          {
            merchantId,
            paymentId,
            reference:
              paymentData.reference || `PAY-${paymentId.toString().slice(-8)}`,
            score: result.score,
            severity: result.level,
            status: "OPEN",
            ruleCode: result.triggeredRules.map((r) => r.ruleCode).join(","),
            summary: `Risk ${result.level}: ${result.explanation}`,
            explanation: result.explanation,
            signals: result.triggeredRules.map((r) => r.ruleCode),
            isDemo: paymentData.isDemo ?? false,
          },
        ],
        { session },
      );
    }

    return decision;
  });
}

async function getDecision({ auth, decisionId }) {
  const decision = await RiskDecision.findOne({
    _id: decisionId,
    merchantId: auth.merchantId,
  }).lean();

  if (!decision) {
    throw new AppError(
      404,
      "RISK_DECISION_NOT_FOUND",
      "Risk decision not found",
    );
  }

  return toDecisionDto(decision);
}

async function listDecisions({ auth, query }) {
  const filter = { merchantId: auth.merchantId };
  if (query.decision) filter.decision = query.decision;
  if (query.level) filter.level = query.level;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const limit = Math.min(query.limit ?? 20, 100);
  const cursor = query.cursor ? { _id: { $lt: query.cursor } } : {};
  const filterWithCursor = { ...filter, ...cursor };

  const decisions = await RiskDecision.find(filterWithCursor)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = decisions.length > limit;
  const items = hasMore ? decisions.slice(0, -1) : decisions;
  const nextCursor = hasMore
    ? String(decisions[decisions.length - 2]._id)
    : null;

  return {
    items: items.map(toDecisionDto),
    nextCursor,
    hasMore,
  };
}

async function getSummary({ auth }) {
  const merchantId = auth.merchantId;
  const [total, byDecision, byLevel] = await Promise.all([
    RiskDecision.countDocuments({ merchantId }),
    RiskDecision.aggregate([
      { $match: { merchantId } },
      { $group: { _id: "$decision", count: { $sum: 1 } } },
    ]),
    RiskDecision.aggregate([
      { $match: { merchantId } },
      { $group: { _id: "$level", count: { $sum: 1 } } },
    ]),
  ]);

  const decisionCounts = {};
  for (const entry of byDecision) {
    decisionCounts[entry._id] = entry.count;
  }

  const levelCounts = {};
  for (const entry of byLevel) {
    levelCounts[entry._id] = entry.count;
  }

  return { total, decisionCounts, levelCounts };
}

async function listAlerts({ auth, query }) {
  const filter = { merchantId: auth.merchantId };
  for (const field of ["severity", "status", "ruleCode"]) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.paymentId) filter.paymentId = query.paymentId;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const items = await RiskAlert.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.min(query.limit ?? 50, 100))
    .lean();

  return {
    items: items.map((alert) => ({
      ...alert,
      id: String(alert._id),
      merchantId: String(alert.merchantId),
      paymentId: alert.paymentId ? String(alert.paymentId) : null,
    })),
  };
}

async function overrideDecision({ auth, decisionId, decision, _reviewedBy }) {
  return runInTransaction(async (session) => {
    const existing = await RiskDecision.findOne({
      _id: decisionId,
      merchantId: auth.merchantId,
    }).session(session);

    if (!existing) {
      throw new AppError(
        404,
        "RISK_DECISION_NOT_FOUND",
        "Risk decision not found",
      );
    }

    if (existing.source === "MANUAL") {
      throw new AppError(
        409,
        "ALREADY_MANUAL",
        "Decision already manually overridden",
      );
    }

    const updated = await RiskDecision.findOneAndUpdate(
      { _id: decisionId, merchantId: auth.merchantId },
      {
        $set: {
          decision,
          source: "MANUAL",
          reviewedBy: auth.user?._id ?? auth.userId,
          reviewedAt: new Date(),
        },
      },
      { returnDocument: "after", session },
    ).lean();

    return toDecisionDto(updated);
  });
}

const toDecisionDto = (decision) => {
  return {
    id: String(decision._id),
    merchantId: String(decision.merchantId),
    paymentId: String(decision.paymentId),
    decision: decision.decision,
    score: decision.score,
    level: decision.level,
    ruleCodes: decision.ruleCodes,
    explanation: decision.explanation,
    source: decision.source,
    reviewedBy: decision.reviewedBy ? String(decision.reviewedBy) : null,
    reviewedAt: decision.reviewedAt,
    createdAt: decision.createdAt,
    updatedAt: decision.updatedAt,
  };
};

export const riskDecisionService = {
  evaluateAndRecord,
  getDecision,
  listDecisions,
  getSummary,
  listAlerts,
  overrideDecision,
  toDecisionDto,
};

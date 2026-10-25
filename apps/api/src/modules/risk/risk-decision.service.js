import mongoose from "mongoose";
import { RISK_DECISION_SOURCE } from "@pratyaya/shared";
import { AppError } from "../../lib/errors.js";
import { runInTransaction } from "../../lib/transaction.js";
import { RiskDecision } from "./risk-decision.model.js";
import { RiskAlert } from "./risk-alert.model.js";

const MAX_LIMIT = 100;

function toDecisionDto(decision) {
  if (!decision) return null;

  return {
    id: String(decision._id),
    merchantId: String(decision.merchantId),
    paymentId: decision.paymentId ? String(decision.paymentId) : null,
    decision: decision.decision,
    score: decision.score,
    level: decision.level,
    ruleCodes: decision.ruleCodes ?? [],
    explanation: decision.explanation,
    source: decision.source,
    reviewedBy: decision.reviewedBy ? String(decision.reviewedBy) : null,
    reviewedAt: decision.reviewedAt ?? null,
    createdAt: decision.createdAt,
    updatedAt: decision.updatedAt,
  };
}

function toAlertDto(alert) {
  return {
    ...alert,
    id: String(alert._id),
    merchantId: String(alert.merchantId),
    paymentId: alert.paymentId ? String(alert.paymentId) : null,
  };
}

function buildDateFilter(query = {}) {
  if (!query.from && !query.to) return null;

  const filter = {};

  if (query.from) filter.$gte = new Date(query.from);
  if (query.to) filter.$lte = new Date(query.to);

  return filter;
}

function getLimit(value, fallback = 20) {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(
      400,
      "INVALID_LIMIT",
      "Limit must be a positive integer",
    );
  }

  return Math.min(parsed, MAX_LIMIT);
}

async function evaluateAndRecord(
  merchantId,
  paymentId,
  paymentData,
  source = "AUTOMATED",
  options = {},
) {
  if (!Object.values(RISK_DECISION_SOURCE).includes(source)) {
    throw new AppError(
      400,
      "INVALID_RISK_DECISION_SOURCE",
      "Invalid risk decision source",
    );
  }

  const { riskEngine } = await import("./risk-engine.service.js");

  const result = await riskEngine.evaluatePayment(merchantId, paymentData);

  const ruleCodes = (result.triggeredRules ?? [])
    .map((rule) => rule.ruleCode)
    .filter(Boolean);

  const persist = async (session) => {
    const [record] = await RiskDecision.create(
      [
        {
          merchantId,
          paymentId,
          decision: result.decision,
          score: result.score,
          level: result.level,
          ruleCodes,
          explanation: result.explanation,
          source,
        },
      ],
      { session },
    );

    if (
      result.decision === "BLOCK" ||
      ["HIGH", "CRITICAL"].includes(result.level)
    ) {
      await RiskAlert.create(
        [
          {
            merchantId,
            paymentId,
            reference:
              paymentData.reference ?? `PAY-${String(paymentId).slice(-8)}`,
            score: result.score,
            severity: result.level,
            status: "OPEN",
            ruleCode: ruleCodes.join(","),
            summary: `Risk ${result.level}: ${result.explanation}`,
            explanation: result.explanation,
            signals: ruleCodes,
            isDemo: Boolean(paymentData.isDemo),
          },
        ],
        { session },
      );
    }

    return {
      decision: record.decision,
      score: record.score,
      level: record.level,
      triggeredRules: result.triggeredRules ?? [],
      explanation: record.explanation,
      source: record.source,
      decisionId: String(record._id),
    };
  };

  if (options.session) {
    return persist(options.session);
  }

  return runInTransaction(persist);
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

async function listDecisions({ auth, query = {} }) {
  const filter = { merchantId: auth.merchantId };

  if (query.decision) filter.decision = query.decision;
  if (query.level) filter.level = query.level;

  const createdAt = buildDateFilter(query);
  if (createdAt) filter.createdAt = createdAt;

  const limit = getLimit(query.limit);

  if (query.cursor) {
    if (!mongoose.isValidObjectId(query.cursor)) {
      throw new AppError(400, "INVALID_CURSOR", "Invalid pagination cursor");
    }

    const cursorRecord = await RiskDecision.findOne({
      _id: query.cursor,
      merchantId: auth.merchantId,
    })
      .select("_id createdAt")
      .lean();

    if (!cursorRecord) {
      throw new AppError(
        400,
        "INVALID_CURSOR",
        "Pagination cursor was not found",
      );
    }

    filter.$or = [
      { createdAt: { $lt: cursorRecord.createdAt } },
      {
        createdAt: cursorRecord.createdAt,
        _id: { $lt: cursorRecord._id },
      },
    ];
  }

  const decisions = await RiskDecision.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = decisions.length > limit;
  const items = decisions.slice(0, limit);

  return {
    items: items.map(toDecisionDto),
    nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
    hasMore,
  };
}

async function getSummary({ auth }) {
  const merchantId = auth.merchantId;

  const [total, byDecision, byLevel] = await Promise.all([
    RiskDecision.countDocuments({ merchantId }),
    RiskDecision.aggregate([
      { $match: { merchantId } },
      {
        $group: {
          _id: "$decision",
          count: { $sum: 1 },
        },
      },
    ]),
    RiskDecision.aggregate([
      { $match: { merchantId } },
      {
        $group: {
          _id: "$level",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const decisionCounts = Object.fromEntries(
    byDecision.map(({ _id, count }) => [_id, count]),
  );

  const levelCounts = Object.fromEntries(
    byLevel.map(({ _id, count }) => [_id, count]),
  );

  return {
    total,
    decisionCounts,
    levelCounts,
  };
}

async function listAlerts({ auth, query = {} }) {
  const filter = { merchantId: auth.merchantId };

  for (const field of ["severity", "status", "ruleCode"]) {
    if (query[field]) filter[field] = query[field];
  }

  if (query.paymentId) {
    filter.paymentId = query.paymentId;
  }

  const createdAt = buildDateFilter(query);
  if (createdAt) filter.createdAt = createdAt;

  const items = await RiskAlert.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(getLimit(query.limit, 50))
    .lean();

  return {
    items: items.map(toAlertDto),
  };
}

async function overrideDecision({ auth, decisionId, decision, reviewedBy }) {
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
      {
        _id: decisionId,
        merchantId: auth.merchantId,
        source: { $ne: "MANUAL" },
      },
      {
        $set: {
          decision,
          source: "MANUAL",
          reviewedBy: reviewedBy ?? auth.user?._id ?? auth.userId,
          reviewedAt: new Date(),
        },
      },
      {
        session,
        runValidators: true,
        returnDocument: "after",
      },
    ).lean();

    if (!updated) {
      throw new AppError(
        409,
        "RISK_DECISION_CONFLICT",
        "Risk decision was modified concurrently",
      );
    }

    return toDecisionDto(updated);
  });
}

export const riskDecisionService = {
  evaluateAndRecord,
  getDecision,
  listDecisions,
  getSummary,
  listAlerts,
  overrideDecision,
  toDecisionDto,
};

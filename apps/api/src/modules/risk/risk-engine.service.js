import { RiskRule } from "./risk-rule.model.js";

const RULE_EVALUATORS = {
  VELOCITY: async (rule, _context) => {
    const { count, windowMs } = rule.conditions;
    const paymentCount = await countRecentPayments(
      _context.merchantId,
      windowMs,
    );
    return paymentCount >= count;
  },
  AMOUNT_ANOMALY: async (rule, _context) => {
    const { multiplier, windowMs } = rule.conditions;
    const avgAmount = await getAverageAmount(_context.merchantId, windowMs);
    return _context.amountMinor >= avgAmount * multiplier;
  },
  FAILED_ATTEMPTS: async (rule, _context) => {
    const { count, windowMs } = rule.conditions;
    const failedCount = await countFailedAttempts(
      _context.merchantId,
      windowMs,
    );
    return failedCount >= count;
  },
  PATTERN: async (rule, _context) => {
    const { pattern } = rule.conditions;
    return evaluatePattern(_context, pattern);
  },
  GEOGRAPHIC: async (rule, _context) => {
    const { blockedCountries, blockedRegions } = rule.conditions;
    return checkGeographicRisk(_context, blockedCountries, blockedRegions);
  },
  CUSTOM: async (rule, _context) => {
    return evaluateCustomRule(rule, _context);
  },
};

async function countRecentPayments(merchantId, windowMs) {
  const RiskDecision = (await import("./risk-decision.model.js")).RiskDecision;
  const cutoff = new Date(Date.now() - windowMs);
  return RiskDecision.countDocuments({
    merchantId,
    createdAt: { $gte: cutoff },
  });
}

async function getAverageAmount(merchantId, windowMs) {
  const RiskDecision = (await import("./risk-decision.model.js")).RiskDecision;
  const cutoff = new Date(Date.now() - windowMs);
  const decisions = await RiskDecision.find({
    merchantId,
    createdAt: { $gte: cutoff },
  }).lean();
  if (decisions.length === 0) return 0;
  const sum = decisions.reduce((sum, d) => sum + (d.score || 0), 0);
  return sum / decisions.length;
}

async function countFailedAttempts(merchantId, windowMs) {
  const RiskAlert = (await import("../risk/risk-alert.model.js")).RiskAlert;
  const cutoff = new Date(Date.now() - windowMs);
  return RiskAlert.countDocuments({
    merchantId,
    severity: { $in: ["HIGH", "CRITICAL"] },
    createdAt: { $gte: cutoff },
  });
}

function evaluatePattern(_context, _pattern) {
  return false;
}

function checkGeographicRisk(_context, _blockedCountries, _blockedRegions) {
  return false;
}

function evaluateCustomRule(_rule, _context) {
  return false;
}

export class RiskEngine {
  constructor() {
    this.rulesCache = null;
    this.cacheExpiry = 0;
  }

  async getActiveRules() {
    const now = Date.now();
    if (this.rulesCache && this.cacheExpiry > now) {
      return this.rulesCache;
    }

    const rules = await RiskRule.find({ isActive: true })
      .sort({ priority: -1, createdAt: 1 })
      .lean();

    this.rulesCache = rules;
    this.cacheExpiry = now + 60000;
    return rules;
  }

  async evaluatePayment(merchantId, paymentData) {
    const rules = await this.getActiveRules();
    const context = {
      merchantId,
      amountMinor: paymentData.amountMinor,
      currency: paymentData.currency,
      customerReference: paymentData.customerReference,
      description: paymentData.description,
    };

    let totalScore = 0;
    const triggeredRules = [];
    let highestSeverity = "LOW";
    let decision = "ALLOW";

    for (const rule of rules) {
      const evaluator = RULE_EVALUATORS[rule.type];
      if (!evaluator) continue;

      try {
        const triggered = await evaluator(rule, context);
        if (triggered) {
          triggeredRules.push({
            ruleCode: rule.ruleCode,
            name: rule.name,
            type: rule.type,
            action: rule.action,
            severity: rule.severity,
            scoreIncrement: rule.scoreIncrement,
          });

          totalScore += rule.scoreIncrement;

          if (this.compareSeverity(rule.severity, highestSeverity) > 0) {
            highestSeverity = rule.severity;
          }

          if (rule.action === "BLOCK" && decision !== "BLOCK") {
            decision = "BLOCK";
          } else if (rule.action === "REVIEW" && decision === "ALLOW") {
            decision = "REVIEW";
          }
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.ruleCode}:`, error);
      }
    }

    const level = this.scoreToLevel(totalScore);

    if (decision === "ALLOW" && level === "CRITICAL") {
      decision = "BLOCK";
    } else if (decision === "ALLOW" && level === "HIGH") {
      decision = "REVIEW";
    }

    return {
      decision,
      score: Math.min(totalScore, 100),
      level,
      triggeredRules,
      explanation: this.generateExplanation(triggeredRules, totalScore),
    };
  }

  compareSeverity(a, b) {
    const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    return (order[a] || 0) - (order[b] || 0);
  }

  scoreToLevel(score) {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 30) return "MEDIUM";
    return "LOW";
  }

  generateExplanation(rules, score) {
    if (rules.length === 0) {
      return `Risk score: ${score}/100. No risk rules triggered.`;
    }
    const ruleDescriptions = rules
      .map((r) => `${r.name} (${r.severity}): +${r.scoreIncrement}`)
      .join("; ");
    return `Risk score: ${score}/100. Triggered rules: ${ruleDescriptions}`;
  }

  async recordDecision(merchantId, paymentId, result, _source = "RULE_ENGINE") {
    const { RiskDecision } = await import("./risk-decision.model.js");
    const { RISK_DECISION_SOURCE } = await import("@pratyaya/shared");

    const decision = await RiskDecision.create({
      merchantId,
      paymentId,
      decision: result.decision,
      score: result.score,
      level: result.level,
      ruleCodes: result.triggeredRules.map((r) => r.ruleCode),
      explanation: result.explanation,
      source: RISK_DECISION_SOURCE.RULE_ENGINE,
    });

    return decision;
  }
}

export const riskEngine = new RiskEngine();

import { sendData } from "../../lib/response.js";
import { riskDecisionService } from "./risk-decision.service.js";
import { AppError } from "../../lib/errors.js";

export async function getRiskDecision(req, res, next) {
  try {
    const decision = await riskDecisionService.getDecision({
      auth: req.auth,
      decisionId: req.params.decisionId,
    });
    sendData(req, res, decision, 200);
  } catch (error) {
    next(error);
  }
}

export async function listRiskDecisions(req, res, next) {
  try {
    const result = await riskDecisionService.listDecisions({
      auth: req.auth,
      query: req.query,
    });
    sendData(req, res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function getRiskSummary(req, res, next) {
  try {
    const summary = await riskDecisionService.getSummary({ auth: req.auth });
    sendData(req, res, summary, 200);
  } catch (error) {
    next(error);
  }
}

export async function overrideRiskDecision(req, res, next) {
  try {
    const decision = await riskDecisionService.overrideDecision({
      auth: req.auth,
      decisionId: req.params.decisionId,
      decision: req.body.decision,
      reviewedBy: req.auth.user?._id ?? req.auth.userId,
    });
    sendData(req, res, decision, 200);
  } catch (error) {
    next(error);
  }
}

export async function evaluateRisk(req, res, next) {
  try {
    const {
      paymentId,
      amountMinor,
      currency,
      customerReference,
      description,
      isDemo,
    } = req.body;

    if (!amountMinor || !currency) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "amountMinor and currency are required",
      );
    }

    const engine = (await import("./risk-engine.service.js")).riskEngine;
    const result = await engine.evaluatePayment(req.auth.merchantId, {
      amountMinor: BigInt(amountMinor),
      currency,
      customerReference,
      description,
      isDemo,
    });

    if (paymentId) {
      const decision = await riskDecisionService.evaluateAndRecord(
        req.auth.merchantId,
        paymentId,
        {
          amountMinor: BigInt(amountMinor),
          currency,
          customerReference,
          description,
          isDemo,
          reference: paymentId,
        },
        "MANUAL",
      );
      return res.json({
        data: { decision, result },
        meta: { requestId: req.requestId },
      });
    }

    res.json({ data: { result }, meta: { requestId: req.requestId } });
  } catch (error) {
    next(error);
  }
}

export async function getRules(req, res, next) {
  try {
    const rules = await (
      await import("./risk-engine.service.js")
    ).riskEngine.getActiveRules();
    res.json({ data: { rules }, meta: { requestId: req.requestId } });
  } catch (error) {
    next(error);
  }
}

export async function listRiskAlerts(req, res, next) {
  try {
    const result = await riskDecisionService.listAlerts({
      auth: req.auth,
      query: req.validated.query,
    });
    sendData(req, res, result, 200);
  } catch (error) {
    next(error);
  }
}

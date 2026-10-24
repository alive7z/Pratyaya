import { sendData } from "../../lib/response.js";
import { agentpayService } from "./agentpay.service.js";
import { AppError } from "../../lib/errors.js";

export async function createPolicy(req, res, next) {
  try {
    const policy = await agentpayService.createPolicy({
      merchantId: req.auth.merchantId,
      policy: req.validated.body,
      req,
      config: req.app.locals.config,
    });
    sendData(req, res, policy, 201);
  } catch (error) {
    next(error);
  }
}

export async function getPolicy(req, res, next) {
  try {
    const policy = await agentpayService.getPolicy({ auth: req.auth });
    sendData(req, res, policy, 200);
  } catch (error) {
    next(error);
  }
}

export async function updatePolicy(req, res, next) {
  try {
    const policy = await agentpayService.updatePolicy({
      auth: req.auth,
      policy: req.validated.body,
      req,
      config: req.app.locals.config,
    });
    sendData(req, res, policy, 200);
  } catch (error) {
    next(error);
  }
}

export async function submitInvoice(req, res, next) {
  try {
    const result = await agentpayService.submitInvoice({
      auth: req.auth,
      body: req.validated.body,
      req,
      config: req.app.locals.config,
    });
    sendData(req, res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function getProposal(req, res, next) {
  try {
    const proposal = await agentpayService.getProposal({
      auth: req.auth,
      proposalId: req.validated.params.proposalId,
    });
    sendData(req, res, proposal, 200);
  } catch (error) {
    next(error);
  }
}

export async function listProposals(req, res, next) {
  try {
    const result = await agentpayService.listProposals({
      auth: req.auth,
      query: req.validated.query ?? {},
    });
    sendData(req, res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function decideProposal(req, res, next) {
  try {
    const result = await agentpayService.decideProposal({
      auth: req.auth,
      proposalId: req.validated.params.proposalId,
      decision: req.validated.body.decision,
      reason: req.validated.body.reason,
      req,
      config: req.app.locals.config,
    });
    sendData(req, res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function executeProposal(req, res, next) {
  try {
    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey) {
      return res.status(400).json({
        error: {
          code: "IDEMPOTENCY_KEY_REQUIRED",
          message: "Idempotency-Key header is required",
        },
        meta: { requestId: req.requestId },
      });
    }

    const result = await agentpayService.executeProposal({
      auth: req.auth,
      proposalId: req.validated.params.proposalId,
      idempotencyKey,
      req,
      config: req.app.locals.config,
    });
    sendData(req, res, result, 201);
  } catch (error) {
    next(error);
  }
}
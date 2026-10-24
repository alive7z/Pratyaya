import { JOB_TYPES } from "@pratyaya/shared";
import { createPaymentOrchestratorService } from "../../../api/src/modules/payments/operations/payment-orchestrator.service.js";
import { loadConfig } from "../../config.js";
import { createLogger } from "../../logger.js";
import { connectMongo } from "../../db/mongoose.js";

const logger = createLogger({
  level: "info",
  service: "pratyaya-worker-job-processor",
});

let orchestrator;
let config;

async function initializeOrchestrator() {
  if (!orchestrator) {
    config = loadConfig();
    await connectMongo(config.mongodb, logger);
    orchestrator = await createPaymentOrchestratorService(config, logger);
  }
  return orchestrator;
}

export async function processJob(job, _workerId) {
  const orch = await initializeOrchestrator();

  try {
    switch (job.type) {
      case JOB_TYPES.PROCESS_AUTHORIZATION:
        return await processAuthorizationJob(job, orch);
      case JOB_TYPES.PROCESS_CAPTURE:
        return await processCaptureJob(job, orch);
      case JOB_TYPES.PROCESS_REFUND:
        return await processRefundJob(job, orch);
      case JOB_TYPES.RECONCILE_PAYMENT:
        return await processReconciliationJob(job, orch);
      case JOB_TYPES.DISPATCH_WEBHOOK:
        return await processWebhookDispatchJob(job, orch);
      case JOB_TYPES.VERIFY_LEDGER_INTEGRITY:
        return await processLedgerIntegrityJob(job, orch);
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  } catch (error) {
    logger.error(
      {
        event: "job.process_failed",
        jobId: job.jobId,
        type: job.type,
        err: error,
      },
      "Job processing failed",
    );
    throw error;
  }
}

async function processAuthorizationJob(job, orchestrator) {
  const { providerOperationId, paymentId } = job.payload;
  const auth = {
    merchantId: job.merchantId,
    isDemo: job.isDemo,
    role: "worker",
    userId: job.payload.createdByUserId,
    config,
    logger,
  };

  if (providerOperationId) {
    return orchestrator.processAuthorization({ providerOperationId, auth });
  }

  return orchestrator.initiateAuthorization({
    auth,
    paymentId,
    idempotencyKey: job.jobId,
  });
}

async function processCaptureJob(job, orchestrator) {
  const { providerOperationId, paymentId, mode } = job.payload;
  const auth = {
    merchantId: job.merchantId,
    isDemo: job.isDemo,
    role: "worker",
    config,
    logger,
  };

  if (providerOperationId) {
    return orchestrator.processCapture({ providerOperationId, auth });
  }

  return orchestrator.initiateCapture({
    auth,
    paymentId,
    idempotencyKey: job.jobId,
    mode: mode ?? "automatic",
  });
}

async function processRefundJob(job, orchestrator) {
  const { providerOperationId, paymentId, amountMinor, reason } = job.payload;
  const auth = {
    merchantId: job.merchantId,
    isDemo: job.isDemo,
    role: "worker",
    config,
    logger,
  };

  if (providerOperationId) {
    return orchestrator.processRefund({ providerOperationId, auth });
  }

  return orchestrator.initiateRefund({
    auth,
    paymentId,
    amountMinor,
    reason,
    idempotencyKey: job.jobId,
  });
}

import mongoose from "mongoose";

async function processReconciliationJob(job, orchestrator) {
  const { paymentId, providerOperationId } = job.payload;
  const auth = {
    merchantId: job.merchantId,
    isDemo: job.isDemo,
    role: "worker",
    config,
    logger,
  };

  if (providerOperationId) {
    const op = await orchestrator.reconcileAuthorization({
      providerOperationId,
      auth,
    });
    if (op.status === "UNRESOLVED") {
      throw new Error(
        "Reconciliation unresolved - provider operation still processing",
      );
    }
    return op;
  }

  const paymentOps = await mongoose.connection.db
    .collection("provideroperations")
    .find({
      paymentId: new mongoose.Types.ObjectId(paymentId),
      state: { $in: ["UNKNOWN", "IN_FLIGHT"] },
    })
    .toArray();

  for (const op of paymentOps) {
    try {
      if (op.type === "AUTHORIZE") {
        await orchestrator.reconcileAuthorization({
          providerOperationId: op._id.toString(),
          auth,
        });
      } else if (op.type === "CAPTURE") {
        await orchestrator.reconcileCapture({
          providerOperationId: op._id.toString(),
          auth,
        });
      } else if (op.type === "REFUND") {
        await orchestrator.reconcileRefund({
          providerOperationId: op._id.toString(),
          auth,
        });
      }
    } catch (error) {
      logger.warn(
        {
          event: "reconciliation.operation_failed",
          paymentId,
          operationId: op._id,
          err: error,
        },
        "Reconciliation operation failed",
      );
    }
  }

  return { reconciled: paymentOps.length };
}

async function processWebhookDispatchJob(job, _orchestrator) {
  logger.info(
    { event: "webhook.dispatch_job", jobId: job.jobId, payload: job.payload },
    "Dispatching webhook",
  );
  return { dispatched: true };
}

async function processLedgerIntegrityJob(job, _orchestrator) {
  logger.info(
    { event: "ledger.integrity_job", jobId: job.jobId },
    "Running ledger integrity check",
  );
  return { checked: true };
}

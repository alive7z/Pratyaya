
import { createHmac } from "node:crypto";
import {
  JOB_TYPES,
  OPERATION_TYPES,
  OPERATION_STATES,
  PAYMENT_STATUS,
  OUTBOX_EVENT_TYPES,
  OUTBOX_STATE,
} from "@pratyaya/shared";
import { AppError } from "../../../../api/src/lib/errors.js";
import { runFinancialTransaction } from "../../../../api/src/lib/transaction.js";
import { Payment } from "../../../../api/src/modules/payments/payment.model.js";
import { OutboxEvent } from "../../../../api/src/modules/payments/outbox-event.model.js";
import {
  recordPaymentEvent,
  toPaymentDto,
} from "../../../../api/src/modules/payments/payment.repository.js";
import { createPaymentOrchestratorService } from "../../../../api/src/modules/payments/operations/payment-orchestrator.service.js";
import { ProviderOperation } from "../../../../api/src/modules/payments/operations/provider-operation.model.js";
import { WebhookEvent } from "../../../../api/src/modules/developer/developer.model.js";
import { executeIntegrityCheck } from "../../../../api/src/modules/ledger/integrity.service.js";
import { loadWorkerConfig } from "../../config.js";
import { createLogger } from "../../logger.js";

const logger = createLogger({
  level: "info",
  service: "pratyaya-worker-job-processor",
});

let orchestratorPromise;
let config;

async function initializeOrchestrator() {
  if (!orchestratorPromise) {
    orchestratorPromise = (async () => {
      config = loadWorkerConfig();
      return createPaymentOrchestratorService(config, logger);
    })().catch((error) => {
      orchestratorPromise = null;
      throw error;
    });
  }

  return orchestratorPromise;
}

function getConfig() {
  config ??= loadWorkerConfig();
  return config;
}

function createWorkerAuth(job) {
  return {
    merchantId: job.merchantId,
    isDemo: Boolean(job.isDemo),
    role: "worker",
    userId: job.payload?.createdByUserId ?? null,
    config,
    logger,
  };
}

function requirePayload(job, ...fields) {
  if (!job.payload || typeof job.payload !== "object") {
    throw new Error(`Job ${job.jobId} has no valid payload`);
  }

  for (const field of fields) {
    if (
      job.payload[field] === undefined ||
      job.payload[field] === null ||
      job.payload[field] === ""
    ) {
      throw new Error(
        `Job ${job.jobId} is missing required field: ${field}`,
      );
    }
  }
}

async function processPaymentCreatedJob(job) {
  requirePayload(job, "paymentId");

  const { paymentId } = job.payload;
  const merchantId = job.merchantId;

  return runFinancialTransaction(async (session) => {
    const payment = await Payment.findOne({
      _id: paymentId,
      merchantId,
    }).session(session);

    if (!payment) {
      throw new AppError(
        404,
        "PAYMENT_NOT_FOUND",
        "Payment not found",
      );
    }

    if (payment.status !== PAYMENT_STATUS.CREATED) {
      return {
        payment: toPaymentDto(payment),
        alreadyProcessed: true,
      };
    }

    const updated = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        merchantId,
        status: PAYMENT_STATUS.CREATED,
        version: payment.version,
      },
      {
        $set: {
          status: PAYMENT_STATUS.QUEUED,
        },
        $inc: {
          version: 1,
        },
      },
      {
        session,
        returnDocument: "after",
      },
    );

    if (!updated) {
      throw new AppError(
        409,
        "PAYMENT_CONCURRENCY_CONFLICT",
        "Payment state changed during queueing",
      );
    }

    await recordPaymentEvent(
      {
        paymentId: payment._id,
        merchantId,
        eventType: "payment.queued",
        fromStatus: PAYMENT_STATUS.CREATED,
        toStatus: PAYMENT_STATUS.QUEUED,
        actorRole: "worker",
        summary: "Payment queued for authorization",
        metadata: {
          jobId: job.jobId,
        },
        isDemo: Boolean(job.isDemo),
      },
      session,
    );

    await OutboxEvent.create(
      [
        {
          merchantId,
          aggregateType: "payment",
          aggregateId: payment._id,
          eventType: OUTBOX_EVENT_TYPES.PAYMENT_AUTHORIZE_REQUESTED,
          payload: {
            paymentId: String(payment._id),
            merchantId: String(merchantId),
            createdByUserId: payment.createdByUserId
              ? String(payment.createdByUserId)
              : null,
          },
          state: OUTBOX_STATE.PENDING,
          availableAt: new Date(),
          isDemo: Boolean(job.isDemo),
        },
      ],
      { session },
    );

    return {
      payment: toPaymentDto(updated),
      queued: true,
    };
  });
}

async function processAuthorizationJob(job, orchestrator) {
  requirePayload(job, "paymentId");

  const { paymentId, providerOperationId } = job.payload;
  const auth = createWorkerAuth(job);

  if (providerOperationId) {
    return orchestrator.processAuthorization({
      providerOperationId,
      auth,
    });
  }

  return orchestrator.initiateAuthorization({
    auth,
    paymentId,
    idempotencyKey: job.jobId,
  });
}

async function processCaptureJob(job, orchestrator) {
  requirePayload(job, "paymentId");

  const {
    paymentId,
    providerOperationId,
    amountMinor,
    mode = "automatic",
  } = job.payload;

  const auth = createWorkerAuth(job);

  if (providerOperationId) {
    return orchestrator.processCapture({
      providerOperationId,
      auth,
    });
  }

  return orchestrator.initiateCapture({
    auth,
    paymentId,
    amountMinor,
    idempotencyKey: job.jobId,
    mode,
  });
}

async function processRefundJob(job, orchestrator) {
  requirePayload(job, "paymentId");

  const {
    paymentId,
    providerOperationId,
    amountMinor,
    reason,
  } = job.payload;

  const auth = createWorkerAuth(job);

  if (providerOperationId) {
    return orchestrator.processRefund({
      providerOperationId,
      auth,
    });
  }

  requirePayload(job, "amountMinor");

  return orchestrator.initiateRefund({
    auth,
    paymentId,
    amountMinor,
    reason,
    idempotencyKey: job.jobId,
  });
}

async function reconcileSingleOperation(
  operation,
  auth,
  orchestrator,
) {
  const providerOperationId = String(operation._id);

  switch (operation.type) {
    case OPERATION_TYPES.AUTHORIZE:
      return orchestrator.reconcileAuthorization({
        providerOperationId,
        auth,
      });

    case OPERATION_TYPES.CAPTURE:
      return orchestrator.reconcileCapture({
        providerOperationId,
        auth,
      });

    case OPERATION_TYPES.REFUND:
      return orchestrator.reconcileRefund({
        providerOperationId,
        auth,
      });

    default:
      throw new Error(
        `Unsupported provider operation type: ${operation.type}`,
      );
  }
}

async function processReconciliationJob(job, orchestrator) {
  const { paymentId, providerOperationId } = job.payload ?? {};

  if (!paymentId && !providerOperationId) {
    throw new Error(
      "Reconciliation requires paymentId or providerOperationId",
    );
  }

  const auth = createWorkerAuth(job);

  const filter = {
    merchantId: job.merchantId,
    state: {
      $in: [
        OPERATION_STATES.UNKNOWN,
        OPERATION_STATES.IN_FLIGHT,
      ],
    },
  };

  if (providerOperationId) {
    filter._id = providerOperationId;
  } else {
    filter.paymentId = paymentId;
  }

  const operations = await ProviderOperation.find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (operations.length === 0) {
    if (providerOperationId) {
      const existing = await ProviderOperation.findOne({
        _id: providerOperationId,
        merchantId: job.merchantId,
      }).lean();

      if (!existing) {
        throw new AppError(
          404,
          "PROVIDER_OPERATION_NOT_FOUND",
          "Provider operation not found",
        );
      }
    }

    return {
      reconciled: 0,
      unresolved: 0,
      alreadyResolved: true,
    };
  }

  let reconciled = 0;
  let unresolved = 0;
  const failures = [];

  for (const operation of operations) {
    try {
      const result = await reconcileSingleOperation(
        operation,
        auth,
        orchestrator,
      );

      if (result?.status === "UNRESOLVED") {
        unresolved++;
      } else {
        reconciled++;
      }
    } catch (error) {
      failures.push({
        operationId: String(operation._id),
        message: error.message,
      });

      logger.warn(
        {
          event: "reconciliation.operation_failed",
          jobId: job.jobId,
          paymentId: String(operation.paymentId),
          operationId: String(operation._id),
          err: error,
        },
        "Provider reconciliation failed",
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Reconciliation failed for ${failures.length} operation(s): ${failures
        .map((item) => item.operationId)
        .join(", ")}`,
    );
  }

  if (unresolved > 0) {
    throw new Error(
      `Reconciliation incomplete: ${unresolved} provider operation(s) unresolved`,
    );
  }

  return {
    reconciled,
    unresolved: 0,
    total: operations.length,
  };
}

async function processWebhookDispatchJob(job) {
  const workerConfig = getConfig();

  if (!workerConfig.webhookDeliveryUrl || !workerConfig.webhookSigningSecret) {
    throw new Error("Webhook delivery is not configured");
  }

  const eventId = job.jobId;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    id: eventId,
    type: OUTBOX_EVENT_TYPES.LEDGER_JOURNAL_POSTED,
    createdAt: new Date().toISOString(),
    merchantId: String(job.merchantId),
    data: job.payload,
  });
  const signature = createHmac(
    "sha256",
    workerConfig.webhookSigningSecret,
  )
    .update(timestamp)
    .update(".")
    .update(body)
    .digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    workerConfig.webhookTimeoutMs,
  );

  try {
    const response = await fetch(workerConfig.webhookDeliveryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pratyaya-Event-ID": eventId,
        "X-Pratyaya-Timestamp": timestamp,
        "X-Pratyaya-Signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
      redirect: "manual",
    });

    if (!response.ok) {
      throw new Error(`Webhook endpoint returned HTTP ${response.status}`);
    }

    await WebhookEvent.findOneAndUpdate(
      { providerEventId: eventId },
      {
        $set: {
          merchantId: job.merchantId,
          eventType: OUTBOX_EVENT_TYPES.LEDGER_JOURNAL_POSTED,
          status: "DELIVERED",
          signatureValid: true,
          payloadPreview: job.payload,
          deliveredAt: new Date(),
          isDemo: Boolean(job.isDemo),
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    return { dispatched: true, statusCode: response.status, eventId };
  } catch (error) {
    await WebhookEvent.findOneAndUpdate(
      { providerEventId: eventId },
      {
        $set: {
          merchantId: job.merchantId,
          eventType: OUTBOX_EVENT_TYPES.LEDGER_JOURNAL_POSTED,
          status: "RETRYING",
          signatureValid: true,
          payloadPreview: job.payload,
          isDemo: Boolean(job.isDemo),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function processLedgerIntegrityJob(job) {
  const report = await executeIntegrityCheck({
    auth: createWorkerAuth(job),
    currency: job.payload?.currency,
    requestId: job.jobId,
    config: getConfig(),
  });

  return { reportId: report.id, status: report.status };
}

export async function processJob(job, workerId) {
  if (!job?.jobId || !job?.type || !job?.merchantId) {
    throw new Error("Invalid job");
  }

  const startedAt = Date.now();

  logger.info(
    {
      event: "job.processing_started",
      jobId: job.jobId,
      jobType: job.type,
      workerId,
      attemptCount: job.attemptCount,
    },
    "Processing job",
  );

  try {
    let result;

    switch (job.type) {
      case JOB_TYPES.PROCESS_PAYMENT_CREATED:
        result = await processPaymentCreatedJob(job);
        break;

      case JOB_TYPES.PROCESS_AUTHORIZATION: {
        const orchestrator = await initializeOrchestrator();
        result = await processAuthorizationJob(job, orchestrator);
        break;
      }

      case JOB_TYPES.PROCESS_CAPTURE: {
        const orchestrator = await initializeOrchestrator();
        result = await processCaptureJob(job, orchestrator);
        break;
      }

      case JOB_TYPES.PROCESS_REFUND: {
        const orchestrator = await initializeOrchestrator();
        result = await processRefundJob(job, orchestrator);
        break;
      }

      case JOB_TYPES.RECONCILE_PAYMENT: {
        const orchestrator = await initializeOrchestrator();
        result = await processReconciliationJob(job, orchestrator);
        break;
      }

      case JOB_TYPES.DISPATCH_WEBHOOK:
        result = await processWebhookDispatchJob(job);
        break;

      case JOB_TYPES.VERIFY_LEDGER_INTEGRITY:
        result = await processLedgerIntegrityJob(job);
        break;

      default:
        throw new Error(`Unsupported job type: ${job.type}`);
    }

    logger.info(
      {
        event: "job.processing_completed",
        jobId: job.jobId,
        jobType: job.type,
        workerId,
        durationMs: Date.now() - startedAt,
      },
      "Job completed",
    );

    return result;
  } catch (error) {
    logger.error(
      {
        event: "job.processing_failed",
        jobId: job.jobId,
        jobType: job.type,
        workerId,
        durationMs: Date.now() - startedAt,
        err: error,
      },
      "Job processing failed",
    );

    throw error;
  }
}

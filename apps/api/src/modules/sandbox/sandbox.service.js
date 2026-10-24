import { AppError } from "../../lib/errors.js";
import { Job } from "./job.model.js";
import { InboxEvent } from "../webhooks/inbox-event.model.js";
import { OutboxEvent } from "../payments/outbox-event.model.js";
import { ProviderOperation } from "../payments/operations/provider-operation.model.js";

function sanitizeFaultConfig(faults) {
  if (!faults || !faults.enabled) return { enabled: false, rules: [] };
  return {
    enabled: true,
    rules: (faults.rules || []).map((r) => ({
      type: r.type,
      enabled: r.enabled,
      delayMs: r.delayMs,
      statusCode: r.statusCode,
      code: r.code,
      message: r.message,
    })),
  };
}

export async function getSandboxJobs({ auth, query }) {
  const filter = { isDemo: auth.isDemo };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const limit = Math.min(query.limit ?? 50, 200);
  const jobs = await Job.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return {
    jobs: jobs.map((job) => ({
      id: String(job._id),
      jobId: job.jobId,
      type: job.type,
      status: job.status,
      merchantId: String(job.merchantId),
      paymentId: job.paymentId ? String(job.paymentId) : null,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      nextAttemptAt: job.nextAttemptAt,
      leaseOwner: job.leaseOwner,
      leaseUntil: job.leaseUntil,
      lastError: job.lastError,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    })),
    count: jobs.length,
  };
}

export async function getSandboxWebhooks({ auth, query }) {
  const filter = { isDemo: auth.isDemo };
  if (query.status) filter.processingStatus = query.status;
  if (query.eventType) filter.eventType = query.eventType;
  if (query.from || query.to) {
    filter.receivedAt = {};
    if (query.from) filter.receivedAt.$gte = new Date(query.from);
    if (query.to) filter.receivedAt.$lte = new Date(query.to);
  }

  const limit = Math.min(query.limit ?? 50, 200);
  const webhooks = await InboxEvent.find(filter)
    .sort({ receivedAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return {
    webhooks: webhooks.map((w) => ({
      id: String(w._id),
      source: w.source,
      providerEventId: w.providerEventId,
      eventType: w.eventType,
      paymentId: w.paymentId ? String(w.paymentId) : null,
      refundId: w.refundId ? String(w.refundId) : null,
      signatureVerified: w.signatureVerified,
      signatureError: w.signatureError,
      receivedAt: w.receivedAt,
      processedAt: w.processedAt,
      processingStatus: w.processingStatus,
      attemptCount: w.attemptCount,
      lastError: w.lastError,
    })),
    count: webhooks.length,
  };
}

export async function getSandboxOutboxEvents({ auth, query }) {
  const filter = { isDemo: auth.isDemo };
  if (query.state) filter.state = query.state;
  if (query.eventType) filter.eventType = query.eventType;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const limit = Math.min(query.limit ?? 50, 200);
  const events = await OutboxEvent.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return {
    events: events.map((e) => ({
      id: String(e._id),
      aggregateType: e.aggregateType,
      aggregateId: String(e.aggregateId),
      eventType: e.eventType,
      payload: e.payload,
      state: e.state,
      attempts: e.attempts,
      availableAt: e.availableAt,
      leaseOwner: e.leaseOwner,
      leaseUntil: e.leaseUntil,
      dispatchedAt: e.dispatchedAt,
      failedAt: e.failedAt,
      error: e.error,
      createdAt: e.createdAt,
    })),
    count: events.length,
  };
}

export async function getProviderOperations({ auth, query }) {
  const filter = { merchantId: auth.merchantId, isDemo: auth.isDemo };
  if (query.type) filter.type = query.type;
  if (query.state) filter.state = query.state;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const limit = Math.min(query.limit ?? 50, 200);
  const operations = await ProviderOperation.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return {
    operations: operations.map((op) => ({
      id: String(op._id),
      type: op.type,
      state: op.state,
      providerOperationId: op.providerOperationId,
      providerReference: op.providerReference,
      clientOperationId: op.clientOperationId,
      amountMinor: op.amountMinor?.toString?.() ?? op.amountMinor,
      currency: op.currency,
      faultInjected: op.faultInjected,
      createdAt: op.createdAt,
      processingCompletedAt: op.processingCompletedAt,
    })),
    count: operations.length,
  };
}

export async function setProviderFaults({ _auth, body, config }) {
  if (!config.faults) {
    throw new AppError(
      400,
      "FAULTS_NOT_CONFIGURED",
      "Fault injection not configured",
    );
  }

  const sanitized = sanitizeFaultConfig(body);
  config.faults = sanitized;

  return { faults: sanitized, updated: true };
}

export async function getProviderFaults({ config }) {
  return { faults: sanitizeFaultConfig(config.faults) };
}

export async function clearProviderFaults({ config }) {
  config.faults = { enabled: false, rules: [] };
  return { faults: { enabled: false, rules: [] }, cleared: true };
}

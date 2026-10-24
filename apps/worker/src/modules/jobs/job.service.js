import { createHash, randomUUID } from "node:crypto";
import {
  JOB_TYPES,
  JOB_STATUS,
  OUTBOX_EVENT_TYPES,
  OUTBOX_STATE,
} from "@pratyaya/shared";
import { Job } from "./job.model.js";
import { OutboxEvent } from "../../../api/src/modules/payments/outbox-event.model.js";

function generateJobId() {
  return `job_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function generateLeaseToken() {
  return createHash("sha256").update(randomUUID()).digest("hex").slice(0, 32);
}

function now() {
  return new Date();
}

const DEFAULT_LEASE_DURATION_MS = 30000;
const DEFAULT_MAX_ATTEMPTS = 5;

export async function createJob({
  type,
  merchantId,
  payload,
  options = {},
  session,
}) {
  const {
    paymentId,
    refundId,
    sourceEventId,
    priority = 0,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    idempotencyKey,
    isDemo = false,
  } = options;

  let jobId;
  if (idempotencyKey) {
    jobId = createHash("sha256")
      .update(`${type}:${idempotencyKey}`)
      .digest("hex")
      .slice(0, 24);
    jobId = `job_${jobId}`;
  } else {
    jobId = generateJobId();
  }

  const existing = await Job.findOne({ jobId }).session(session).lean();
  if (existing) {
    return { job: existing, idempotent: true };
  }

  let job;
  try {
    [job] = await Job.create(
      [
        {
          jobId,
          type,
          merchantId,
          paymentId,
          refundId,
          sourceEventId,
          payload,
          status: JOB_STATUS.PENDING,
          priority,
          maxAttempts,
          nextAttemptAt: now(),
          isDemo,
        },
      ],
      { session },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const concurrent = await Job.findOne({ jobId }).session(session).lean();
    if (!concurrent) throw error;
    return { job: concurrent, idempotent: true };
  }

  return { job, idempotent: false };
}

export async function claimJobs({
  workerId,
  maxJobs = 10,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  session,
}) {
  const leaseToken = generateLeaseToken();
  const leaseUntil = new Date(Date.now() + leaseDurationMs);

  const jobs = await Job.find({
    status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RETRY] },
    nextAttemptAt: { $lte: now() },
    $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now() } }],
  })
    .sort({ priority: -1, nextAttemptAt: 1, _id: 1 })
    .limit(maxJobs)
    .session(session);

  const claimed = [];
  for (const job of jobs) {
    const updated = await Job.findOneAndUpdate(
      {
        _id: job._id,
        status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RETRY] },
        $or: [
          { leaseUntil: { $exists: false } },
          { leaseUntil: { $lt: now() } },
        ],
        version: job.version,
      },
      {
        $set: {
          status: JOB_STATUS.PROCESSING,
          leaseOwner: workerId,
          leaseUntil,
          leaseToken,
          lastAttemptAt: now(),
        },
        $inc: { attemptCount: 1, version: 1 },
      },
      { returnDocument: "after", session },
    );

    if (updated) {
      claimed.push(updated);
    }
  }

  return claimed;
}

export async function releaseJob({
  jobId,
  workerId,
  leaseToken,
  success,
  error,
  session,
}) {
  const update = {
    $unset: { leaseOwner: 1, leaseUntil: 1, leaseToken: 1 },
  };

  if (success) {
    update.$set = {
      status: JOB_STATUS.COMPLETED,
      completedAt: now(),
    };
  } else {
    const job = await Job.findById(jobId).session(session).lean();
    if (!job) return { success: false, reason: "job_not_found" };

    const nextAttempt = job.attemptCount >= job.maxAttempts;
    const status = nextAttempt ? JOB_STATUS.DEAD_LETTER : JOB_STATUS.RETRY;
    const nextAttemptAt = nextAttempt
      ? null
      : new Date(Date.now() + calculateBackoff(job.attemptCount));

    update.$set = {
      status,
      nextAttemptAt,
      lastError: error?.message ?? "Unknown error",
    };

    update.$push = {
      errorHistory: {
        attempt: job.attemptCount,
        error: error?.message ?? "Unknown error",
        timestamp: now(),
      },
    };
  }

  const result = await Job.findOneAndUpdate(
    { _id: jobId, leaseOwner: workerId, leaseToken },
    update,
    { returnDocument: "after", session },
  );

  return { success: !!result, job: result };
}

function calculateBackoff(attemptCount) {
  const baseDelay = 1000;
  const maxDelay = 60000;
  const delay = Math.min(
    baseDelay * Math.pow(2, attemptCount - 1) + Math.random() * 1000,
    maxDelay,
  );
  return delay;
}

export async function recoverStaleJobs({
  workerId,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  session,
}) {
  const staleThreshold = new Date(Date.now() - leaseDurationMs * 2);

  const staleJobs = await Job.find({
    status: JOB_STATUS.PROCESSING,
    leaseUntil: { $lt: now() },
    leaseOwner: { $ne: workerId },
    updatedAt: { $lt: staleThreshold },
  }).session(session);

  const recovered = [];
  for (const job of staleJobs) {
    const updated = await Job.findOneAndUpdate(
      {
        _id: job._id,
        status: JOB_STATUS.PROCESSING,
        leaseUntil: { $lt: now() },
        leaseOwner: { $ne: workerId },
      },
      {
        $set: {
          status: JOB_STATUS.RETRY,
          leaseOwner: null,
          leaseUntil: null,
          leaseToken: null,
          nextAttemptAt: now(),
        },
        $inc: { version: 1 },
      },
      { returnDocument: "after", session },
    );

    if (updated) {
      recovered.push(updated);
    }
  }

  return recovered;
}

export async function createJobsFromOutbox({
  workerId,
  batchSize = 50,
  session,
}) {
  const candidates = await OutboxEvent.find({
    state: OUTBOX_STATE.PENDING,
    availableAt: { $lte: now() },
    $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now() } }],
  })
    .sort({ availableAt: 1, _id: 1 })
    .limit(batchSize)
    .session(session);

  const created = [];
  for (const candidate of candidates) {
    const leaseUntil = new Date(Date.now() + DEFAULT_LEASE_DURATION_MS);
    const event = await OutboxEvent.findOneAndUpdate(
      {
        _id: candidate._id,
        state: OUTBOX_STATE.PENDING,
        availableAt: { $lte: now() },
        $or: [
          { leaseUntil: { $exists: false } },
          { leaseUntil: { $lt: now() } },
        ],
      },
      {
        $set: {
          leaseOwner: workerId,
          leaseUntil,
          leasedAt: now(),
        },
      },
      { returnDocument: "after", session },
    );
    if (!event) continue;

    const jobType = mapOutboxEventToJobType(event.eventType);
    if (!jobType) {
      await OutboxEvent.updateOne(
        { _id: event._id, leaseOwner: workerId },
        {
          $set: {
            state: OUTBOX_STATE.FAILED,
            failedAt: now(),
            error: `Unsupported outbox event type: ${event.eventType}`,
          },
          $unset: { leaseOwner: 1, leaseUntil: 1, leasedAt: 1 },
        },
        { session },
      );
      continue;
    }

    const idempotencyKey = `outbox:${event._id}:${
      event.idempotencyKeyHash ?? "event"
    }`;

    const result = await createJob({
      type: jobType,
      merchantId: event.merchantId,
      payload: { ...event.payload, outboxEventId: String(event._id) },
      options: {
        sourceEventId: event._id,
        priority: getJobPriority(event.eventType),
        idempotencyKey,
        isDemo: event.isDemo,
      },
      session,
    });

    await OutboxEvent.updateOne(
      { _id: event._id, state: OUTBOX_STATE.PENDING, leaseOwner: workerId },
      { $set: { state: OUTBOX_STATE.PROCESSING } },
      { session },
    );

    created.push(result.job);
  }

  return created;
}

function mapOutboxEventToJobType(eventType) {
  const mapping = {
    [OUTBOX_EVENT_TYPES.PAYMENT_AUTHORIZE_REQUESTED]:
      JOB_TYPES.PROCESS_AUTHORIZATION,
    [OUTBOX_EVENT_TYPES.PAYMENT_CAPTURE_REQUESTED]: JOB_TYPES.PROCESS_CAPTURE,
    [OUTBOX_EVENT_TYPES.PAYMENT_REFUND_REQUESTED]: JOB_TYPES.PROCESS_REFUND,
    [OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED]:
      JOB_TYPES.RECONCILE_PAYMENT,
    [OUTBOX_EVENT_TYPES.LEDGER_JOURNAL_POSTED]: JOB_TYPES.DISPATCH_WEBHOOK,
  };
  return mapping[eventType];
}

function getJobPriority(eventType) {
  const priorities = {
    [OUTBOX_EVENT_TYPES.PAYMENT_AUTHORIZE_REQUESTED]: 5,
    [OUTBOX_EVENT_TYPES.PAYMENT_CAPTURE_REQUESTED]: 5,
    [OUTBOX_EVENT_TYPES.PAYMENT_REFUND_REQUESTED]: 5,
    [OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED]: 3,
    [OUTBOX_EVENT_TYPES.LEDGER_JOURNAL_POSTED]: 2,
  };
  return priorities[eventType] ?? 0;
}

export async function markOutboxEventDispatched({
  outboxEventId,
  workerId,
  session,
}) {
  await OutboxEvent.updateOne(
    { _id: outboxEventId, leaseOwner: workerId },
    {
      $set: {
        state: OUTBOX_STATE.DISPATCHED,
        dispatchedAt: now(),
      },
      $unset: { leaseOwner: 1, leaseUntil: 1, leasedAt: 1 },
    },
    { session },
  );
}

export async function markOutboxEventFailed({
  outboxEventId,
  workerId,
  error,
  session,
}) {
  const event = await OutboxEvent.findOne({
    _id: outboxEventId,
    leaseOwner: workerId,
  })
    .session(session)
    .lean();
  if (!event) return;

  const attempts = (event.attempts ?? 0) + 1;
  const exhausted = attempts >= 5;
  const nextState = exhausted ? OUTBOX_STATE.FAILED : OUTBOX_STATE.PENDING;

  await OutboxEvent.updateOne(
    { _id: outboxEventId, leaseOwner: workerId },
    {
      $set: {
        state: nextState,
        error: error?.message ?? "Unknown error",
        failedAt: exhausted ? now() : null,
        availableAt: exhausted
          ? event.availableAt
          : new Date(Date.now() + calculateBackoff(attempts)),
      },
      $inc: { attempts: 1 },
      $unset: { leaseOwner: 1, leaseUntil: 1, leasedAt: 1 },
    },
    { session },
  );
}

export { JOB_TYPES, JOB_STATUS };


import { createHash, randomUUID } from "node:crypto";
import {
  JOB_TYPES,
  JOB_STATUS,
  OUTBOX_EVENT_TYPES,
  OUTBOX_STATE,
} from "@pratyaya/shared";
import { Job } from "./job.model.js";
import { OutboxEvent } from "../../../../api/src/modules/payments/outbox-event.model.js";

const DEFAULT_LEASE_DURATION_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_BATCH_SIZE = 100;

const now = () => new Date();

function generateJobId() {
  return `job_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function generateLeaseToken() {
  return randomUUID().replace(/-/g, "");
}

function calculateBackoff(attemptCount) {
  const delay = Math.min(
    1_000 * 2 ** Math.max(0, attemptCount - 1),
    60_000,
  );

  return delay + Math.floor(Math.random() * 500);
}

function getErrorMessage(error) {
  const message =
    typeof error === "string"
      ? error
      : error?.message ?? "Unknown error";

  return String(message).slice(0, 500);
}

function validateBatchSize(value, fallback) {
  const size = Number(value ?? fallback);

  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Batch size must be a positive integer");
  }

  return Math.min(size, MAX_BATCH_SIZE);
}

function validateLeaseDuration(value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Lease duration must be a positive integer");
  }

  return value;
}

function validateWorkerId(workerId) {
  if (
    typeof workerId !== "string" ||
    !workerId.trim() ||
    workerId.length > 64
  ) {
    throw new Error("A valid worker ID is required");
  }

  return workerId;
}

function availableLeaseFilter(date) {
  return {
    $or: [
      { leaseUntil: { $exists: false } },
      { leaseUntil: null },
      { leaseUntil: { $lte: date } },
    ],
  };
}

function mapOutboxEventToJobType(eventType) {
  const mapping = {

    [OUTBOX_EVENT_TYPES.PAYMENT_CREATED]:
      JOB_TYPES.PROCESS_PAYMENT_CREATED,

    [OUTBOX_EVENT_TYPES.PAYMENT_AUTHORIZE_REQUESTED]:
      JOB_TYPES.PROCESS_AUTHORIZATION,

    [OUTBOX_EVENT_TYPES.PAYMENT_CAPTURE_REQUESTED]:
      JOB_TYPES.PROCESS_CAPTURE,

    [OUTBOX_EVENT_TYPES.PAYMENT_REFUND_REQUESTED]:
      JOB_TYPES.PROCESS_REFUND,

    [OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED]:
      JOB_TYPES.RECONCILE_PAYMENT,

    [OUTBOX_EVENT_TYPES.LEDGER_JOURNAL_POSTED]:
      JOB_TYPES.DISPATCH_WEBHOOK,
  };

  return mapping[eventType] ?? null;
}

function getJobPriority(eventType) {
  const priorities = {
    [OUTBOX_EVENT_TYPES.PAYMENT_CREATED]: 5,
    [OUTBOX_EVENT_TYPES.PAYMENT_AUTHORIZE_REQUESTED]: 5,
    [OUTBOX_EVENT_TYPES.PAYMENT_CAPTURE_REQUESTED]: 5,
    [OUTBOX_EVENT_TYPES.PAYMENT_REFUND_REQUESTED]: 5,
    [OUTBOX_EVENT_TYPES.PAYMENT_RECONCILIATION_REQUESTED]: 3,
    [OUTBOX_EVENT_TYPES.LEDGER_JOURNAL_POSTED]: 2,
  };

  return priorities[eventType] ?? 0;
}

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

  if (!type || !merchantId || !payload) {
    throw new Error("Job type, merchant ID and payload are required");
  }

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }

  const jobId = idempotencyKey
    ? `job_${createHash("sha256")
        .update(
          JSON.stringify([
            String(merchantId),
            type,
            String(idempotencyKey),
          ]),
        )
        .digest("hex")
        .slice(0, 24)}`
    : generateJobId();

  const existing = await Job.findOne({ jobId })
    .session(session ?? null)
    .lean();

  if (existing) {
    if (
      existing.type !== type ||
      String(existing.merchantId) !== String(merchantId)
    ) {
      throw new Error("Job idempotency conflict");
    }

    return { job: existing, idempotent: true };
  }

  try {
    const [job] = await Job.create(
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
          attemptCount: 0,
          nextAttemptAt: now(),
          isDemo: Boolean(isDemo),
        },
      ],
      session ? { session } : {},
    );

    return { job, idempotent: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const concurrent = await Job.findOne({ jobId })
      .session(session ?? null)
      .lean();

    if (!concurrent) throw error;

    if (
      concurrent.type !== type ||
      String(concurrent.merchantId) !== String(merchantId)
    ) {
      throw new Error("Job idempotency conflict");
    }

    return { job: concurrent, idempotent: true };
  }
}

export async function claimJobs({
  workerId,
  maxJobs = 10,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  session,
}) {
  validateWorkerId(workerId);
  validateLeaseDuration(leaseDurationMs);

  const limit = validateBatchSize(maxJobs, 10);
  const claimed = [];

  for (let index = 0; index < limit; index++) {
    const claimedAt = now();
    const leaseToken = generateLeaseToken();

    const job = await Job.findOneAndUpdate(
      {
        status: {
          $in: [JOB_STATUS.PENDING, JOB_STATUS.RETRY],
        },
        nextAttemptAt: { $lte: claimedAt },
        ...availableLeaseFilter(claimedAt),
      },
      {
        $set: {
          status: JOB_STATUS.PROCESSING,
          leaseOwner: workerId,
          leaseToken,
          leaseUntil: new Date(
            claimedAt.getTime() + leaseDurationMs,
          ),
          lastAttemptAt: claimedAt,
        },
        $inc: {
          attemptCount: 1,
          version: 1,
        },
      },
      {
        sort: {
          priority: -1,
          nextAttemptAt: 1,
          _id: 1,
        },
        returnDocument: "after",
        ...(session ? { session } : {}),
      },
    );

    if (!job) break;

    claimed.push(job);
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
  validateWorkerId(workerId);

  if (!leaseToken) {
    throw new Error("Lease token is required");
  }

  const filter = {
    _id: jobId,
    status: JOB_STATUS.PROCESSING,
    leaseOwner: workerId,
    leaseToken,
    leaseUntil: { $gt: now() },
  };

  const job = await Job.findOne(filter)
    .session(session ?? null)
    .lean();

  if (!job) {
    return {
      success: false,
      reason: "lease_not_owned_or_expired",
    };
  }

  const update = {
    $set: {},
    $unset: {
      leaseOwner: 1,
      leaseUntil: 1,
      leaseToken: 1,
    },
    $inc: { version: 1 },
  };

  if (success) {
    update.$set = {
      status: JOB_STATUS.COMPLETED,
      completedAt: now(),
      nextAttemptAt: null,
      lastError: null,
    };
  } else {
    const exhausted =
      job.attemptCount >=
      (job.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

    update.$set = {
      status: exhausted
        ? JOB_STATUS.DEAD_LETTER
        : JOB_STATUS.RETRY,
      nextAttemptAt: exhausted
        ? null
        : new Date(
            Date.now() + calculateBackoff(job.attemptCount),
          ),
      lastError: getErrorMessage(error),
    };

    update.$push = {
      errorHistory: {
        attempt: job.attemptCount,
        error: getErrorMessage(error),
        timestamp: now(),
      },
    };
  }

  const updated = await Job.findOneAndUpdate(
    {
      ...filter,
      version: job.version,
    },
    update,
    {
      returnDocument: "after",
      ...(session ? { session } : {}),
    },
  );

  return {
    success: Boolean(updated),
    job: updated,
    reason: updated ? null : "lease_lost",
  };
}

export async function renewJobLease({
  jobId,
  workerId,
  leaseToken,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  session,
}) {
  validateWorkerId(workerId);
  validateLeaseDuration(leaseDurationMs);

  if (!leaseToken) {
    throw new Error("Lease token is required");
  }

  const renewedAt = now();
  const job = await Job.findOneAndUpdate(
    {
      _id: jobId,
      status: JOB_STATUS.PROCESSING,
      leaseOwner: workerId,
      leaseToken,
      leaseUntil: { $gt: renewedAt },
    },
    {
      $set: {
        leaseUntil: new Date(
          renewedAt.getTime() + leaseDurationMs,
        ),
      },
      $inc: { version: 1 },
    },
    {
      returnDocument: "after",
      ...(session ? { session } : {}),
    },
  );

  return {
    success: Boolean(job),
    job,
    reason: job ? null : "lease_not_owned_or_expired",
  };
}

export async function recoverStaleJobs({
  workerId,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  session,
}) {
  validateWorkerId(workerId);
  validateLeaseDuration(leaseDurationMs);

  const recovered = [];

  for (let index = 0; index < MAX_BATCH_SIZE; index++) {
    const currentTime = now();

    const staleJob = await Job.findOne({
      status: JOB_STATUS.PROCESSING,
      leaseUntil: { $lte: currentTime },
    })
      .sort({ leaseUntil: 1, _id: 1 })
      .session(session ?? null)
      .lean();

    if (!staleJob) break;

    const exhausted =
      staleJob.attemptCount >=
      (staleJob.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

    const updated = await Job.findOneAndUpdate(
      {
        _id: staleJob._id,
        status: JOB_STATUS.PROCESSING,
        leaseUntil: { $lte: currentTime },
        leaseToken: staleJob.leaseToken,
      },
      {
        $set: {
          status: exhausted
            ? JOB_STATUS.DEAD_LETTER
            : JOB_STATUS.RETRY,
          nextAttemptAt: exhausted ? null : currentTime,
          lastError: "Worker lease expired",
        },
        $unset: {
          leaseOwner: 1,
          leaseUntil: 1,
          leaseToken: 1,
        },
        $inc: { version: 1 },
      },
      {
        returnDocument: "after",
        ...(session ? { session } : {}),
      },
    );

    if (updated) recovered.push(updated);
  }

  return recovered;
}

export async function createJobsFromOutbox({
  workerId,
  batchSize = 50,
  session,
}) {
  validateWorkerId(workerId);

  const limit = validateBatchSize(batchSize, 50);
  const created = [];

  for (let index = 0; index < limit; index++) {
    const claimedAt = now();

    const event = await OutboxEvent.findOneAndUpdate(
      {
        state: OUTBOX_STATE.PENDING,
        availableAt: { $lte: claimedAt },
        ...availableLeaseFilter(claimedAt),
      },
      {
        $set: {
          leaseOwner: workerId,
          leaseUntil: new Date(
            claimedAt.getTime() + DEFAULT_LEASE_DURATION_MS,
          ),
          leasedAt: claimedAt,
        },
      },
      {
        sort: {
          availableAt: 1,
          _id: 1,
        },
        returnDocument: "after",
        ...(session ? { session } : {}),
      },
    );

    if (!event) break;

    const jobType = mapOutboxEventToJobType(event.eventType);

    if (!jobType) {
      await OutboxEvent.updateOne(
        {
          _id: event._id,
          state: OUTBOX_STATE.PENDING,
          leaseOwner: workerId,
        },
        {
          $set: {
            state: OUTBOX_STATE.FAILED,
            failedAt: now(),
            error: `Unsupported outbox event: ${event.eventType}`,
          },
          $unset: {
            leaseOwner: 1,
            leaseUntil: 1,
            leasedAt: 1,
          },
        },
        session ? { session } : {},
      );

      continue;
    }

    try {
      const idempotencyKey = `outbox:${event._id}`;

      const result = await createJob({
        type: jobType,
        merchantId: event.merchantId,
        payload: {
          ...event.payload,
          outboxEventId: String(event._id),
        },
        options: {
          sourceEventId: event._id,
          paymentId: event.payload?.paymentId,
          refundId: event.payload?.refundId,
          priority: getJobPriority(event.eventType),
          idempotencyKey,
          isDemo: event.isDemo,
        },
        session,
      });

      const updated = await OutboxEvent.findOneAndUpdate(
        {
          _id: event._id,
          state: OUTBOX_STATE.PENDING,
          leaseOwner: workerId,
        },
        {
          $set: {
            state: OUTBOX_STATE.PROCESSING,
            error: null,
          },
          $unset: {
            leaseOwner: 1,
            leaseUntil: 1,
            leasedAt: 1,
          },
        },
        {
          returnDocument: "after",
          ...(session ? { session } : {}),
        },
      );

      if (updated) {
        created.push(result.job);
      }
    } catch (error) {
      await OutboxEvent.updateOne(
        {
          _id: event._id,
          state: OUTBOX_STATE.PENDING,
          leaseOwner: workerId,
        },
        {
          $set: {
            availableAt: new Date(
              Date.now() +
                calculateBackoff((event.attempts ?? 0) + 1),
            ),
            error: getErrorMessage(error),
          },
          $inc: { attempts: 1 },
          $unset: {
            leaseOwner: 1,
            leaseUntil: 1,
            leasedAt: 1,
          },
        },
        session ? { session } : {},
      );

      throw error;
    }
  }

  return created;
}

export async function markOutboxEventDispatched({
  outboxEventId,
  workerId,
  session,
}) {
  const filter = {
    _id: outboxEventId,
    state: OUTBOX_STATE.PROCESSING,
  };

  if (workerId) {
    validateWorkerId(workerId);
  }

  const result = await OutboxEvent.findOneAndUpdate(
    filter,
    {
      $set: {
        state: OUTBOX_STATE.DISPATCHED,
        dispatchedAt: now(),
        error: null,
      },
      $unset: {
        leaseOwner: 1,
        leaseUntil: 1,
        leasedAt: 1,
      },
    },
    {
      returnDocument: "after",
      ...(session ? { session } : {}),
    },
  );

  return {
    success: Boolean(result),
    event: result,
  };
}

export async function markOutboxEventFailed({
  outboxEventId,
  workerId,
  error,
  session,
}) {
  if (workerId) {
    validateWorkerId(workerId);
  }

  const event = await OutboxEvent.findOne({
    _id: outboxEventId,
    state: OUTBOX_STATE.PROCESSING,
  })
    .session(session ?? null)
    .lean();

  if (!event) {
    return {
      success: false,
      reason: "outbox_event_not_processing",
    };
  }

  const attempts = (event.attempts ?? 0) + 1;
  const exhausted = attempts >= DEFAULT_MAX_ATTEMPTS;

  const updated = await OutboxEvent.findOneAndUpdate(
    {
      _id: event._id,
      state: OUTBOX_STATE.PROCESSING,
      attempts: event.attempts ?? 0,
    },
    {
      $set: {
        state: exhausted
          ? OUTBOX_STATE.FAILED
          : OUTBOX_STATE.PENDING,
        error: getErrorMessage(error),
        failedAt: exhausted ? now() : null,
        availableAt: exhausted
          ? event.availableAt
          : new Date(
              Date.now() + calculateBackoff(attempts),
            ),
      },
      $inc: { attempts: 1 },
      $unset: {
        leaseOwner: 1,
        leaseUntil: 1,
        leasedAt: 1,
      },
    },
    {
      returnDocument: "after",
      ...(session ? { session } : {}),
    },
  );

  return {
    success: Boolean(updated),
    event: updated,
  };
}

export { JOB_TYPES, JOB_STATUS };

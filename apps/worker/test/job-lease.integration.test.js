import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOB_STATUS, JOB_TYPES } from "@pratyaya/shared";
import { loadWorkerConfig } from "../src/config.js";
import { connectMongo, disconnectMongo } from "../src/db/mongoose.js";
import { Job } from "../src/modules/jobs/job.model.js";
import {
  claimJobs,
  createJob,
  recoverStaleJobs,
  releaseJob,
  renewJobLease,
} from "../src/modules/jobs/job.service.js";

const enabled = process.env.RUN_INTEGRATION_TESTS === "1";

describe.skipIf(!enabled)("worker job leases", () => {
  const merchantId = new mongoose.Types.ObjectId();
  const workerId = "worker-lease-integration";

  beforeAll(async () => {
    const config = loadWorkerConfig();
    await connectMongo({ ...config, autoIndex: false });
  }, 30_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await Job.deleteMany({ merchantId });
    }
    await disconnectMongo();
  });

  it("renews an owned 30-second lease and rejects the wrong token", async () => {
    const { job } = await createJob({
      type: JOB_TYPES.PROCESS_PAYMENT_CREATED,
      merchantId,
      payload: { paymentId: new mongoose.Types.ObjectId().toString() },
      options: { idempotencyKey: `lease-${Date.now()}` },
    });

    const [claimed] = await claimJobs({
      workerId,
      maxJobs: 1,
      leaseDurationMs: 30_000,
    });

    expect(String(claimed._id)).toBe(String(job._id));
    expect(claimed.status).toBe(JOB_STATUS.PROCESSING);
    const originalLeaseUntil = claimed.leaseUntil.getTime();

    const renewal = await renewJobLease({
      jobId: claimed._id,
      workerId,
      leaseToken: claimed.leaseToken,
      leaseDurationMs: 30_000,
    });

    expect(renewal.success).toBe(true);
    expect(renewal.job.leaseUntil.getTime()).toBeGreaterThanOrEqual(
      originalLeaseUntil,
    );

    const rejected = await renewJobLease({
      jobId: claimed._id,
      workerId,
      leaseToken: "not-the-owned-token",
      leaseDurationMs: 30_000,
    });
    expect(rejected).toMatchObject({
      success: false,
      reason: "lease_not_owned_or_expired",
    });

    const released = await releaseJob({
      jobId: claimed._id,
      workerId,
      leaseToken: claimed.leaseToken,
      success: true,
    });
    expect(released.success).toBe(true);
    expect(released.job.status).toBe(JOB_STATUS.COMPLETED);
  });

  it("recovers an expired lease for retry", async () => {
    await createJob({
      type: JOB_TYPES.PROCESS_PAYMENT_CREATED,
      merchantId,
      payload: { paymentId: new mongoose.Types.ObjectId().toString() },
      options: { idempotencyKey: `stale-${Date.now()}` },
    });

    const [claimed] = await claimJobs({
      workerId,
      maxJobs: 1,
      leaseDurationMs: 10,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));

    const recovered = await recoverStaleJobs({
      workerId,
      leaseDurationMs: 30_000,
    });
    const recoveredJob = recovered.find(
      (item) => String(item._id) === String(claimed._id),
    );

    expect(recoveredJob?.status).toBe(JOB_STATUS.RETRY);
    expect(recoveredJob?.lastError).toBe("Worker lease expired");
  });
});

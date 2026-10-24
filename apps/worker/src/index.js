import { createServer } from "node:http";
import mongoose from "mongoose";
import { loadWorkerConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { connectMongo, disconnectMongo, pingMongo } from "./db/mongoose.js";
import { Job } from "./modules/jobs/job.model.js";
import {
  claimJobs,
  releaseJob,
  recoverStaleJobs,
  createJobsFromOutbox,
  markOutboxEventDispatched,
  markOutboxEventFailed,
} from "./modules/jobs/job.service.js";
import { processJob } from "./modules/jobs/job-processor.js";

mongoose.set("bufferCommands", false);
mongoose.set("autoCreate", false);

const config = loadWorkerConfig();
const logger = createLogger({
  level: config.logLevel,
  service: config.service.name,
});

let shuttingDown = false;
let workerId = `worker-${process.pid}-${Date.now()}`;
let processingInterval = null;
let outboxInterval = null;
let recoveryInterval = null;
const POLL_INTERVAL_MS = 5000;
const MAX_JOBS_PER_POLL = 10;
const LEASE_DURATION_MS = 30000;

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health/live") {
    sendJson(res, 200, {
      status: "ok",
      service: config.service.name,
      version: config.service.version,
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health/ready") {
    try {
      await pingMongo();
      sendJson(res, 200, {
        status: "ready",
        service: config.service.name,
        checks: { database: { status: "up" } },
      });
    } catch {
      sendJson(res, 503, {
        status: "not_ready",
        service: config.service.name,
        checks: { database: { status: "down", code: "DATABASE_UNAVAILABLE" } },
      });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/health/jobs") {
    try {
      const pendingCount = await Job.countDocuments({
        status: { $in: ["PENDING", "RETRY"] },
      });
      const processingCount = await Job.countDocuments({
        status: "PROCESSING",
      });
      const deadLetterCount = await Job.countDocuments({
        status: "DEAD_LETTER",
      });
      sendJson(res, 200, {
        status: "ok",
        service: config.service.name,
        jobs: {
          pending: pendingCount,
          processing: processingCount,
          deadLetter: deadLetterCount,
        },
      });
    } catch {
      sendJson(res, 503, {
        status: "not_ready",
        service: config.service.name,
      });
    }
    return;
  }

  sendJson(res, 404, {
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

async function processJobsLoop() {
  if (shuttingDown) return;

  const session = await mongoose.startSession();
  try {
    const claimedJobs = await claimJobs({
      workerId,
      maxJobs: MAX_JOBS_PER_POLL,
      leaseDurationMs: LEASE_DURATION_MS,
      session,
    });

    for (const job of claimedJobs) {
      if (shuttingDown) break;

      let success = false;
      let error = null;
      try {
        await processJob(job, workerId);
        success = true;
      } catch (err) {
        error = err;
        logger.error(
          {
            event: "job.process_error",
            jobId: job.jobId,
            type: job.type,
            err: err,
          },
          "Job processing error",
        );
      }

      await releaseJob({
        jobId: job._id,
        workerId,
        leaseToken: job.leaseToken,
        success,
        error,
        session,
      });

      if (success && job.payload?.outboxEventId) {
        await markOutboxEventDispatched({
          outboxEventId: job.payload.outboxEventId,
          workerId,
          session,
        });
      } else if (!success && job.payload?.outboxEventId) {
        await markOutboxEventFailed({
          outboxEventId: job.payload.outboxEventId,
          workerId,
          error,
          session,
        });
      }
    }
  } catch (error) {
    logger.error(
      { event: "worker.jobs_loop_error", err: error },
      "Jobs loop error",
    );
  } finally {
    await session.endSession();
  }
}

async function outboxRelayLoop() {
  if (shuttingDown) return;

  const session = await mongoose.startSession();
  try {
    await createJobsFromOutbox({ workerId, batchSize: 20, session });
  } catch (error) {
    logger.error(
      { event: "worker.outbox_relay_error", err: error },
      "Outbox relay error",
    );
  } finally {
    await session.endSession();
  }
}

async function staleJobRecoveryLoop() {
  if (shuttingDown) return;

  const session = await mongoose.startSession();
  try {
    const recovered = await recoverStaleJobs({
      workerId,
      leaseDurationMs: LEASE_DURATION_MS,
      session,
    });
    if (recovered.length > 0) {
      logger.info(
        { event: "worker.stale_jobs_recovered", count: recovered.length },
        "Recovered stale jobs",
      );
    }
  } catch (error) {
    logger.error(
      { event: "worker.stale_recovery_error", err: error },
      "Stale job recovery error",
    );
  } finally {
    await session.endSession();
  }
}

async function startProcessingLoops() {
  logger.info(
    { event: "worker.processing_started" },
    "Starting job processing loops",
  );

  processingInterval = setInterval(() => {
    processJobsLoop().catch((err) => {
      logger.error(
        { event: "worker.process_loop_crash", err },
        "Process jobs loop crashed",
      );
    });
  }, POLL_INTERVAL_MS);

  outboxInterval = setInterval(() => {
    outboxRelayLoop().catch((err) => {
      logger.error(
        { event: "worker.outbox_loop_crash", err },
        "Outbox relay loop crashed",
      );
    });
  }, POLL_INTERVAL_MS * 2);

  recoveryInterval = setInterval(() => {
    staleJobRecoveryLoop().catch((err) => {
      logger.error(
        { event: "worker.recovery_loop_crash", err },
        "Stale recovery loop crashed",
      );
    });
  }, 60000);

  await processJobsLoop();
  await outboxRelayLoop();
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(
    { event: "worker.shutdown", signal },
    "Shutting down Pratyaya worker",
  );

  if (processingInterval) {
    clearInterval(processingInterval);
  }
  if (outboxInterval) {
    clearInterval(outboxInterval);
  }
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
  }

  const forceExit = setTimeout(() => {
    logger.fatal(
      { event: "worker.shutdown.forced" },
      "Graceful shutdown timed out",
    );
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise((resolve) => server.close(resolve));
  await disconnectMongo();
  clearTimeout(forceExit);
  logger.info({ event: "worker.stopped" }, "Pratyaya worker stopped");
  process.exit(0);
}

async function start() {
  await connectMongo(config, logger);

  await Job.init();

  server.listen(config.healthPort, "0.0.0.0", () => {
    logger.info(
      {
        event: "worker.started",
        nodeEnv: config.nodeEnv,
        healthPort: config.healthPort,
        workerId,
      },
      "Pratyaya worker started with job processing enabled",
    );
  });

  await startProcessingLoops();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  logger.fatal(
    { event: "process.unhandledRejection", err: reason },
    "Unhandled rejection",
  );
  process.exit(1);
});
process.on("uncaughtException", (error) => {
  logger.fatal(
    { event: "process.uncaughtException", err: error },
    "Uncaught exception",
  );
  process.exit(1);
});

start().catch((error) => {
  logger.fatal(
    {
      event: "worker.start_failed",
      errorName: error.name,
      message: String(error.message).replace(
        /mongodb(?:\+srv)?:\/\/[^\s"']+/gi,
        "[REDACTED_MONGODB_URI]",
      ),
    },
    "Worker failed to start",
  );
  process.exit(1);
});

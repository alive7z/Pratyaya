
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { JOB_STATUS } from "@pratyaya/shared";
import { loadWorkerConfig } from "./config.js";
import { createLogger } from "./logger.js";
import {
  connectMongo,
  disconnectMongo,
  pingMongo,
} from "./db/mongoose.js";
import { Job } from "./modules/jobs/job.model.js";
import {
  claimJobs,
  renewJobLease,
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

const workerId = `worker-${randomUUID().slice(0, 8)}`;

const POLL_INTERVAL_MS = 5_000;
const OUTBOX_POLL_INTERVAL_MS = 5_000;
const RECOVERY_INTERVAL_MS = 30_000;
const MAX_JOBS_PER_POLL = 10;
const LEASE_DURATION_MS = 30_000;
const LEASE_RENEW_INTERVAL_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 15_000;

let shuttingDown = false;
let started = false;

const intervals = new Set();
const activeTasks = new Set();

function trackTask(promise) {
  activeTasks.add(promise);
  promise.finally(() => activeTasks.delete(promise)).catch(() => {});
  return promise;
}

function sendJson(res, statusCode, body) {
  if (res.headersSent) return;

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const pathname = req.url?.split("?")[0];

  if (req.method !== "GET") {
    sendJson(res, 405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed",
      },
    });
    return;
  }

  if (pathname === "/health/live") {
    sendJson(res, shuttingDown ? 503 : 200, {
      status: shuttingDown ? "stopping" : "ok",
      service: config.service.name,
      version: config.service.version,
    });
    return;
  }

  if (pathname === "/health/ready") {
    if (shuttingDown || !started) {
      sendJson(res, 503, {
        status: "not_ready",
        service: config.service.name,
      });
      return;
    }

    try {
      await pingMongo();

      sendJson(res, 200, {
        status: "ready",
        service: config.service.name,
        checks: {
          database: { status: "up" },
          worker: { status: "running" },
        },
      });
    } catch {
      sendJson(res, 503, {
        status: "not_ready",
        service: config.service.name,
        checks: {
          database: {
            status: "down",
            code: "DATABASE_UNAVAILABLE",
          },
        },
      });
    }

    return;
  }

  if (pathname === "/health/jobs") {
    try {
      const [
        pending,
        retry,
        processing,
        completed,
        deadLetter,
      ] = await Promise.all([
        Job.countDocuments({ status: JOB_STATUS.PENDING }),
        Job.countDocuments({ status: JOB_STATUS.RETRY }),
        Job.countDocuments({ status: JOB_STATUS.PROCESSING }),
        Job.countDocuments({ status: JOB_STATUS.COMPLETED }),
        Job.countDocuments({ status: JOB_STATUS.DEAD_LETTER }),
      ]);

      sendJson(res, 200, {
        status: "ok",
        service: config.service.name,
        jobs: {
          pending,
          retry,
          processing,
          completed,
          deadLetter,
        },
      });
    } catch (error) {
      logger.error(
        { event: "worker.health_jobs_failed", err: error },
        "Failed to read job health",
      );

      sendJson(res, 503, {
        status: "not_ready",
        service: config.service.name,
      });
    }

    return;
  }

  sendJson(res, 404, {
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
});

function startPolling(name, intervalMs, handler) {
  let running = false;

  const execute = () => {
    if (shuttingDown || running) return;

    running = true;

    const task = Promise.resolve()
      .then(handler)
      .catch((error) => {
        logger.error(
          { event: `worker.${name}_failed`, err: error },
          `${name} failed`,
        );
      })
      .finally(() => {
        running = false;
      });

    trackTask(task);
  };

  const interval = setInterval(execute, intervalMs);
  intervals.add(interval);

  execute();
}

async function processJobsLoop() {
  if (shuttingDown) return;

  const claimedJobs = await claimJobs({
    workerId,
    maxJobs: MAX_JOBS_PER_POLL,
    leaseDurationMs: LEASE_DURATION_MS,
  });

  for (const job of claimedJobs) {
    if (shuttingDown) break;

    let success = false;
    let processingError = null;
    let leaseLost = false;

    const renewalInterval = setInterval(async () => {
      try {
        const renewal = await renewJobLease({
          jobId: job._id,
          workerId,
          leaseToken: job.leaseToken,
          leaseDurationMs: LEASE_DURATION_MS,
        });

        if (!renewal.success) {
          leaseLost = true;
          clearInterval(renewalInterval);
          logger.error(
            {
              event: "job.lease_renewal_failed",
              jobId: job.jobId,
              workerId,
            },
            "Job lease renewal failed",
          );
        }
      } catch (error) {
        leaseLost = true;
        clearInterval(renewalInterval);
        logger.error(
          {
            event: "job.lease_renewal_error",
            jobId: job.jobId,
            workerId,
            err: error,
          },
          "Job lease renewal errored",
        );
      }
    }, LEASE_RENEW_INTERVAL_MS);

    try {
      await processJob(job, workerId);
      success = true;
    } catch (error) {
      processingError = error;

      logger.error(
        {
          event: "job.process_failed",
          jobId: job.jobId,
          type: job.type,
          err: error,
        },
        "Job processing failed",
      );
    } finally {
      clearInterval(renewalInterval);
    }

    if (leaseLost) {
      logger.error(
        {
          event: "job.result_discarded_after_lease_loss",
          jobId: job.jobId,
          workerId,
        },
        "Job result cannot be acknowledged after lease loss",
      );
      continue;
    }

    const release = await releaseJob({
      jobId: job._id,
      workerId,
      leaseToken: job.leaseToken,
      success,
      error: processingError,
    });

    if (!release.success) {
      logger.error(
        {
          event: "job.lease_lost",
          jobId: job.jobId,
          workerId,
        },
        "Job lease was lost before completion",
      );

      continue;
    }

    const outboxEventId = job.payload?.outboxEventId;

    if (!outboxEventId) continue;

    if (success) {
      await markOutboxEventDispatched({
        outboxEventId,
        workerId,
      });
    } else if (
      release.job?.status === JOB_STATUS.DEAD_LETTER
    ) {
      await markOutboxEventFailed({
        outboxEventId,
        workerId,
        error: processingError,
      });
    }
  }
}

async function outboxRelayLoop() {
  if (shuttingDown) return;

  const jobs = await createJobsFromOutbox({
    workerId,
    batchSize: 20,
  });

  if (jobs.length > 0) {
    logger.info(
      {
        event: "worker.outbox_jobs_created",
        count: jobs.length,
      },
      "Outbox events converted into jobs",
    );
  }
}

async function staleJobRecoveryLoop() {
  if (shuttingDown) return;

  const recovered = await recoverStaleJobs({
    workerId,
    leaseDurationMs: LEASE_DURATION_MS,
  });

  if (recovered.length > 0) {
    logger.warn(
      {
        event: "worker.stale_jobs_recovered",
        count: recovered.length,
      },
      "Recovered expired job leases",
    );
  }
}

async function startProcessingLoops() {
  startPolling(
    "outbox_relay",
    OUTBOX_POLL_INTERVAL_MS,
    outboxRelayLoop,
  );

  startPolling(
    "job_processing",
    POLL_INTERVAL_MS,
    processJobsLoop,
  );

  startPolling(
    "stale_recovery",
    RECOVERY_INTERVAL_MS,
    staleJobRecoveryLoop,
  );

  logger.info(
    {
      event: "worker.processing_started",
      workerId,
    },
    "Worker processing loops started",
  );
}

async function closeServer() {
  if (!server.listening) return;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });

    server.closeIdleConnections?.();
  });
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;

  shuttingDown = true;
  started = false;

  logger.info(
    {
      event: "worker.shutdown",
      signal,
      activeTasks: activeTasks.size,
    },
    "Shutting down Pratyaya worker",
  );

  for (const interval of intervals) {
    clearInterval(interval);
  }

  intervals.clear();

  const forceExit = setTimeout(() => {
    logger.fatal(
      { event: "worker.shutdown_forced" },
      "Worker shutdown timed out",
    );

    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceExit.unref();

  try {
    await Promise.allSettled([
      closeServer(),
      Promise.allSettled([...activeTasks]),
    ]);

    await disconnectMongo();

    logger.info(
      { event: "worker.stopped" },
      "Pratyaya worker stopped",
    );
  } catch (error) {
    exitCode = 1;

    logger.error(
      { event: "worker.shutdown_failed", err: error },
      "Worker shutdown failed",
    );
  } finally {
    clearTimeout(forceExit);
    process.exitCode = exitCode;
  }
}

async function start() {
  await connectMongo(config, logger);
  await Job.init();

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);

    server.listen(
      config.healthPort,
      "0.0.0.0",
    );
  });

  started = true;

  logger.info(
    {
      event: "worker.started",
      nodeEnv: config.nodeEnv,
      healthPort: config.healthPort,
      workerId,
    },
    "Pratyaya worker started",
  );

  await startProcessingLoops();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.fatal(
    {
      event: "process.unhandledRejection",
      err: reason,
    },
    "Unhandled rejection",
  );

  void shutdown("UNHANDLED_REJECTION", 1);
});

process.on("uncaughtException", (error) => {
  logger.fatal(
    {
      event: "process.uncaughtException",
      err: error,
    },
    "Uncaught exception",
  );

  process.exit(1);
});

start().catch(async (error) => {
  logger.fatal(
    {
      event: "worker.start_failed",
      err: error,
    },
    "Worker failed to start",
  );

  await shutdown("STARTUP_FAILURE", 1);
});

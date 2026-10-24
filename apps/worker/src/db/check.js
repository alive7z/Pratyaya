import mongoose from "mongoose";
import { loadWorkerConfig } from "../config.js";
import { createLogger } from "../logger.js";

mongoose.set("bufferCommands", false);

const config = loadWorkerConfig();
const logger = createLogger({
  level: config.logLevel,
  service: "pratyaya-worker-db-check",
});

function sanitize(message) {
  return String(message).replace(
    /mongodb(?:\+srv)?:\/\/[^\s]+/gi,
    "[REDACTED_MONGODB_URI]",
  );
}

async function main() {
  await mongoose.connect(config.mongodbUri, {
    appName: config.service.name,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: config.mongodbServerSelectionTimeoutMs,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    autoIndex: false,
  });

  const connection = mongoose.connection;
  await connection.db.admin().command({ ping: 1 });

  const hello = await connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    throw new Error(
      "Worker MongoDB is reachable but does not report a replica-set topology",
    );
  }

  const session = await connection.startSession();
  try {
    session.startTransaction();
    await connection.db
      .collection("_pratyaya_worker_connection_checks")
      .insertOne(
        { marker: "worker-check", createdAt: new Date() },
        { session },
      );
    await session.abortTransaction();
  } finally {
    await session.endSession();
  }

  logger.info(
    {
      event: "worker.mongodb.check.succeeded",
      replicaSet: hello.setName,
      transactionCapabilityVerified: true,
      database: connection.db.databaseName,
    },
    "Worker MongoDB Atlas connectivity and transaction rollback verified",
  );
}

main()
  .catch((error) => {
    logger.error(
      {
        event: "worker.mongodb.check.failed",
        errorName: error.name,
        message: sanitize(error.message),
      },
      "Worker MongoDB Atlas connectivity check failed",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

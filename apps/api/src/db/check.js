import { loadConfig } from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { connectMongo, disconnectMongo, pingMongo } from "./mongoose.js";

const config = loadConfig();
const logger = createLogger({
  level: config.logLevel,
  service: "pratyaya-db-check",
});

function sanitize(message) {
  return String(message).replace(
    /mongodb(?:\+srv)?:\/\/[^\s]+/gi,
    "[REDACTED_MONGODB_URI]",
  );
}

async function verifyTransactionCapability(connection) {
  const collection = connection.db.collection("_pratyaya_connection_checks");
  const session = await connection.startSession();
  const marker = `check-${Date.now()}`;

  try {
    session.startTransaction();
    await collection.insertOne({ marker, createdAt: new Date() }, { session });
    await session.abortTransaction();

    const leftover = await collection.countDocuments({ marker });
    if (leftover !== 0) {
      throw new Error("Transaction rollback did not remove the check document");
    }
  } finally {
    await session.endSession();
  }
}

async function main() {
  const connection = await connectMongo(config.mongodb, logger);
  await pingMongo(connection);

  const hello = await connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    throw new Error(
      "MongoDB Atlas is reachable but does not report a replica-set topology; ACID transactions require an Atlas replica set",
    );
  }

  await verifyTransactionCapability(connection);

  logger.info(
    {
      event: "mongodb.check.succeeded",
      replicaSet: hello.setName,
      writablePrimary: Boolean(hello.isWritablePrimary),
      transactionCapabilityVerified: true,
      database: connection.db.databaseName,
    },
    "MongoDB Atlas connectivity, replica-set topology, and transaction rollback verified",
  );
}

main()
  .catch((error) => {
    logger.error(
      {
        event: "mongodb.check.failed",
        errorName: error.name,
        message: sanitize(error.message),
      },
      "MongoDB Atlas connectivity check failed",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });

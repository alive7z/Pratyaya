import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { connectMongo, disconnectMongo, pingMongo } from "./mongoose.js";

const config = loadConfig();

const logger = createLogger({
  level: config.logLevel,
  service: "pratyaya-provider-db-check",
});

function sanitize(message) {
  return String(message ?? "").replace(
    /mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi,
    "[REDACTED_MONGODB_URI]",
  );
}

async function verifyTransactionCapability(connection) {
  const collection = connection.db.collection(
    "_pratyaya_provider_connection_checks",
  );

  const session = await connection.startSession();
  const marker = `provider-check-${randomUUID()}`;

  try {
    await session.withTransaction(async () => {
      await collection.insertOne(
        {
          marker,
          createdAt: new Date(),
        },
        { session },
      );

      throw new TransactionRollbackSignal();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackSignal)) {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  const leftover = await collection.countDocuments({ marker });

  if (leftover !== 0) {
    throw new Error("Transaction rollback verification failed");
  }
}

class TransactionRollbackSignal extends Error {
  constructor() {
    super("Intentional transaction rollback");
    this.name = "TransactionRollbackSignal";
  }
}

async function main() {
  let connected = false;

  try {
    const connection = await connectMongo(config.mongodb, logger);
    connected = true;

    await pingMongo(connection);

    const hello = await connection.db.admin().command({ hello: 1 });

    if (!hello.setName) {
      throw new Error(
        "MongoDB replica set is required for multi-document transactions",
      );
    }

    if (!hello.isWritablePrimary) {
      throw new Error(
        "MongoDB connection is not connected to a writable primary",
      );
    }

    await verifyTransactionCapability(connection);

    logger.info(
      {
        event: "provider.mongodb.check.succeeded",
        replicaSet: hello.setName,
        writablePrimary: true,
        transactionCapabilityVerified: true,
        database: connection.db.databaseName,
      },
      "Provider MongoDB connectivity and transaction rollback verified",
    );
  } catch (error) {
    logger.error(
      {
        event: "provider.mongodb.check.failed",
        errorName: error?.name ?? "Error",
        message: sanitize(error?.message),
      },
      "Provider MongoDB connectivity check failed",
    );

    process.exitCode = 1;
  } finally {
    if (connected) {
      try {
        await disconnectMongo();
      } catch (error) {
        logger.error(
          {
            event: "provider.mongodb.disconnect.failed",
            message: sanitize(error?.message),
          },
          "Failed to disconnect from MongoDB",
        );

        process.exitCode = 1;
      }
    }
  }
}

await main();

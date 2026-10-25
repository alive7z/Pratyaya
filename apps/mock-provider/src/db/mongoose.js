import mongoose from "mongoose";
import { withTimeout } from "../lib/async.js";
import { ProviderOperation } from "../modules/operations/provider-operation.model.js";

mongoose.set("bufferCommands", false);
mongoose.set("autoCreate", false);

function sanitize(message) {
  return String(message ?? "").replace(
    /mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi,
    "[REDACTED_MONGODB_URI]",
  );
}

let listenersRegistered = false;

function registerConnectionListeners(connection, logger) {
  if (listenersRegistered) return;

  connection.on("connected", () => {
    logger?.info?.(
      { event: "mongodb.connected" },
      "Provider MongoDB connected",
    );
  });

  connection.on("disconnected", () => {
    logger?.warn?.(
      { event: "mongodb.disconnected" },
      "Provider MongoDB disconnected",
    );
  });

  connection.on("error", (error) => {
    logger?.error?.(
      {
        event: "mongodb.error",
        errorName: error?.name ?? "Error",
        message: sanitize(error?.message),
      },
      "Provider MongoDB connection error",
    );
  });

  listenersRegistered = true;
}

export async function connectMongo(config, logger, options = {}) {
  if (!config?.uri) {
    throw new Error("Provider MongoDB connection URI is required");
  }

  const connection = mongoose.connection;

  registerConnectionListeners(connection, logger);

  if (connection.readyState === 1) {
    return connection;
  }

  try {
    await mongoose.connect(config.uri, {
      appName: "pratyaya-mock-provider",
      maxPoolSize: config.maxPoolSize ?? 10,
      serverSelectionTimeoutMS: config.serverSelectionTimeoutMs ?? 5000,
      connectTimeoutMS: config.connectTimeoutMs ?? 10000,
      socketTimeoutMS: config.socketTimeoutMs ?? 45000,
      autoIndex: config.autoIndex ?? true,
    });

    await pingMongo(connection);

    if (options.initializeModels !== false) {
      await ProviderOperation.init();
    }

    logger?.info?.(
      {
        event: "mongodb.ready",
        database: connection.db.databaseName,
      },
      "Provider MongoDB initialized successfully",
    );

    return connection;
  } catch (error) {
    logger?.error?.(
      {
        event: "mongodb.connection.failed",
        errorName: error?.name ?? "Error",
        message: sanitize(error?.message),
      },
      "Provider MongoDB initialization failed",
    );

    await mongoose.disconnect().catch(() => {});

    throw error;
  }
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState === 0) return;

  await mongoose.disconnect();
}

export async function pingMongo(
  connection = mongoose.connection,
  timeoutMs = 2000,
) {
  if (connection.readyState !== 1 || !connection.db) {
    throw new Error("Provider MongoDB is not connected");
  }

  await withTimeout(
    connection.db.admin().command({ ping: 1 }),
    timeoutMs,
    "provider database",
  );

  return true;
}

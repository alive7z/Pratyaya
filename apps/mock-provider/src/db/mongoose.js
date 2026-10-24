import mongoose from "mongoose";
import { withTimeout } from "../lib/async.js";
import { ProviderOperation } from "../modules/operations/provider-operation.model.js";

mongoose.set("bufferCommands", false);
mongoose.set("autoCreate", false);

function sanitize(message) {
  return String(message).replace(
    /mongodb(?:\+srv)?:\/\/[^\s"']+/gi,
    "[REDACTED_MONGODB_URI]",
  );
}

export async function connectMongo(config, logger) {
  const connection = mongoose.connection;

  connection.on("disconnected", () => {
    logger?.info(
      { event: "mongodb.disconnected" },
      "Provider MongoDB connection closed",
    );
  });
  connection.on("error", (error) => {
    logger?.error(
      {
        event: "mongodb.error",
        errorName: error.name,
        message: sanitize(error.message),
      },
      "Provider MongoDB connection error",
    );
  });

  await mongoose.connect(config.uri, {
    appName: "pratyaya-mock-provider",
    maxPoolSize: config.maxPoolSize,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMs,
    connectTimeoutMS: config.connectTimeoutMs,
    socketTimeoutMS: config.socketTimeoutMs,
    autoIndex: config.autoIndex,
  });

  await ProviderOperation.init();

  return connection;
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
}

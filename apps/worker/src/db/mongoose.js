import mongoose from "mongoose";
import { withTimeout } from "../lib/async.js";

mongoose.set("bufferCommands", false);
mongoose.set("autoCreate", false);

function sanitize(message) {
  return String(message).replace(
    /mongodb(?:\+srv)?:\/\/[^\s"']+/gi,
    "[REDACTED_MONGODB_URI]",
  );
}

export function connectionOptions(config) {
  return {
    appName: config.service.name,
    maxPoolSize: config.mongodbMaxPoolSize,
    serverSelectionTimeoutMS: config.mongodbServerSelectionTimeoutMs,
    connectTimeoutMS: config.mongodbConnectTimeoutMs,
    socketTimeoutMS: config.mongodbSocketTimeoutMs,
    autoIndex: config.autoIndex,
  };
}

export async function connectMongo(config, logger) {
  const connection = mongoose.connection;

  connection.on("connected", () => {
    logger?.info(
      { event: "mongodb.connected" },
      "Worker MongoDB connection established",
    );
  });
  connection.on("disconnected", () => {
    logger?.info(
      { event: "mongodb.disconnected" },
      "Worker MongoDB connection closed",
    );
  });
  connection.on("error", (error) => {
    logger?.error(
      {
        event: "mongodb.error",
        errorName: error.name,
        message: sanitize(error.message),
      },
      "Worker MongoDB connection error",
    );
  });

  await mongoose.connect(config.mongodbUri, connectionOptions(config));
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
    throw new Error("Worker MongoDB is not connected");
  }
  await withTimeout(
    connection.db.admin().command({ ping: 1 }),
    timeoutMs,
    "worker database",
  );
}

export function mongoStatus(connection = mongoose.connection) {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return states[connection.readyState] ?? "unknown";
}

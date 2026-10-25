import mongoose from "mongoose";
import { withTimeout } from "../lib/async.js";

mongoose.set("bufferCommands", false);
// Models are imported before the connection is opened. With command buffering
// disabled, eager collection creation would race startup and cache a rejected
// Model.init() promise. Collections are created by MongoDB when indexes or the
// first validated write are issued after connect.
mongoose.set("autoCreate", false);

function sanitize(message) {
  return String(message).replace(
    /mongodb(?:\+srv)?:\/\/[^\s"']+/gi,
    "[REDACTED_MONGODB_URI]",
  );
}

export function connectionOptions(config) {
  return {
    appName: config.appName,
    maxPoolSize: config.maxPoolSize,
    minPoolSize: config.minPoolSize,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMs,
    connectTimeoutMS: config.connectTimeoutMs,
    socketTimeoutMS: config.socketTimeoutMs,
    autoIndex: config.autoIndex,
  };
}

export async function connectMongo(config, logger) {
  const connection = mongoose.connection;

  connection.on("connected", () => {
    logger?.info(
      { event: "mongodb.connected" },
      "MongoDB connection established",
    );
  });
  connection.on("disconnected", () => {
    logger?.info(
      { event: "mongodb.disconnected" },
      "MongoDB connection closed",
    );
  });
  connection.on("error", (error) => {
    logger?.error(
      {
        event: "mongodb.error",
        errorName: error.name,
        message: sanitize(error.message),
      },
      "MongoDB connection error",
    );
  });

  await mongoose.connect(config.uri, connectionOptions(config));
  return connection;
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

export async function pingMongo(
  connection = mongoose.connection,
  timeoutMs = 5000,
) {
  if (connection.readyState !== 1 || !connection.db) {
    throw new Error("MongoDB is not connected");
  }

  await withTimeout(
    connection.db.admin().command({ ping: 1 }),
    timeoutMs,
    "mongodb",
  );
}

export function mongoStatus(connection = mongoose.connection) {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return states[connection.readyState] ?? "unknown";
}

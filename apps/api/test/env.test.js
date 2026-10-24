import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config/env.js";

const atlasUri =
  "mongodb+srv://cluster.example.invalid/pratyaya?retryWrites=true&w=majority";

describe("API environment validation", () => {
  it("requires an explicit Atlas connection string", () => {
    expect(() => parseConfig({})).toThrow("MONGODB_URI is required");
  });

  it("accepts an Atlas URI and applies safe MongoDB defaults", () => {
    const config = parseConfig({ MONGODB_URI: atlasUri });

    expect(config.mongodb.uri).toBe(atlasUri);
    expect(config.mongodb.serverSelectionTimeoutMs).toBe(5000);
    expect(config.mongodb.autoIndex).toBe(true);
  });

  it("rejects non-MongoDB connection strings without echoing a secret", () => {
    expect(() =>
      parseConfig({ MONGODB_URI: "https://user:secret@example.test/database" }),
    ).toThrow("MONGODB_URI must be a MongoDB Atlas connection string");

    try {
      parseConfig({
        MONGODB_URI: "https://user:secret@example.test/database",
      });
    } catch (error) {
      expect(error.message).not.toContain("user:secret");
    }
  });

  it("rejects local non-Atlas MongoDB connection strings", () => {
    expect(() =>
      parseConfig({
        MONGODB_URI: "mongodb://localhost:27017/pratyaya?replicaSet=rs0",
      }),
    ).toThrow("MONGODB_URI must be a MongoDB Atlas connection string");
  });

  it("refuses the development JWT secret in production", () => {
    expect(() =>
      parseConfig({
        NODE_ENV: "production",
        MONGODB_URI: atlasUri,
      }),
    ).toThrow("AUTH_JWT_SECRET must be set");
  });
});

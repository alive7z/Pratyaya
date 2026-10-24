import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config/env.js";
import {
  connectMongo,
  disconnectMongo,
  mongoStatus,
  pingMongo,
} from "../../src/db/mongoose.js";

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "1";
const silentLogger = {
  info() {},
  warn() {},
  error() {},
};

describe.skipIf(!integrationEnabled)(
  "MongoDB replica-set integration health",
  () => {
    let connection;
    let app;

    beforeAll(async () => {
      const config = loadConfig();
      connection = await connectMongo(config.mongodb, silentLogger);
      const database = {
        ping: () => pingMongo(connection),
        status: () => mongoStatus(connection),
      };
      app = createApp({ database, config, logger: silentLogger });
    });

    afterAll(async () => {
      await disconnectMongo();
    });

    it("reaches real MongoDB", async () => {
      const response = await request(app)
        .get("/api/v1/health/ready")
        .expect(200);

      expect(response.body.data.status).toBe("ready");
      expect(response.body.data.checks.database.status).toBe("up");
    });

    it("runs as a writable replica set suitable for transactions", async () => {
      const hello = await connection.db.admin().command({ hello: 1 });
      expect(hello.setName).toBeTruthy();
      expect(hello.isWritablePrimary).toBe(true);
    });

    it("commits and aborts multi-document transactions correctly", async () => {
      const collection = connection.db.collection("m01_transaction_checks");
      await collection.deleteMany({ suite: "m01" });

      const committedSession = await connection.startSession();
      try {
        await committedSession.withTransaction(async () => {
          await collection.insertMany(
            [
              { suite: "m01", marker: "debit" },
              { suite: "m01", marker: "credit" },
            ],
            { session: committedSession },
          );
        });
      } finally {
        await committedSession.endSession();
      }

      expect(await collection.countDocuments({ suite: "m01" })).toBe(2);

      const abortedSession = await connection.startSession();
      try {
        await expect(
          abortedSession.withTransaction(async () => {
            await collection.insertOne(
              { suite: "m01", marker: "must-rollback" },
              { session: abortedSession },
            );
            throw new Error("deliberate rollback");
          }),
        ).rejects.toThrow("deliberate rollback");
      } finally {
        await abortedSession.endSession();
      }

      expect(await collection.countDocuments({ marker: "must-rollback" })).toBe(
        0,
      );
      await collection.deleteMany({ suite: "m01" });
    });
  },
);

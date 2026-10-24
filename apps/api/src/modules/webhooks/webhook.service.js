import { createHmac, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { InboxEvent } from "./inbox-event.model.js";
import { createPaymentOrchestratorService } from "../payments/operations/payment-orchestrator.service.js";
import { AppError } from "../../lib/errors.js";

const MAX_TIMESTAMP_DRIFT_SECONDS = 300;

function verifySignature(rawBody, signature, timestamp, secret) {
  const message = `${timestamp}.${rawBody.toString("utf8")}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(message)
    .digest("hex");
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  if (sigBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expectedBuffer);
}

export async function processProviderWebhook({
  payload,
  rawBody,
  headers,
  config,
  logger,
}) {
  const signature = headers["x-signature"];
  const timestamp = headers["x-timestamp"];
  const providerEventId = headers["x-provider-event-id"];

  if (!signature || !timestamp || !providerEventId) {
    throw new AppError(
      400,
      "WEBHOOK_MISSING_HEADERS",
      "Missing required webhook headers",
    );
  }

  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    throw new AppError(
      400,
      "WEBHOOK_INVALID_TIMESTAMP",
      "Invalid timestamp header",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNum) > MAX_TIMESTAMP_DRIFT_SECONDS) {
    throw new AppError(
      400,
      "WEBHOOK_TIMESTAMP_DRIFT",
      "Timestamp outside acceptable window",
    );
  }

  if (
    !verifySignature(
      rawBody ?? Buffer.from(JSON.stringify(payload)),
      signature,
      timestamp,
      config.mockProviderHmacSecret,
    )
  ) {
    throw new AppError(
      401,
      "WEBHOOK_INVALID_SIGNATURE",
      "Invalid webhook signature",
    );
  }

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const payloadDigest = createHmac("sha256", config.mockProviderHmacSecret)
        .update(JSON.stringify(payload))
        .digest("hex")
        .slice(0, 64);

      const existing = await InboxEvent.findOne({
        source: "mock-provider",
        providerEventId,
      })
        .session(session)
        .lean();
      if (existing) {
        return { inboxEvent: existing, duplicate: true };
      }

      const merchantId = payload.merchantId;
      if (!merchantId || !mongoose.isValidObjectId(merchantId)) {
        throw new AppError(
          400,
          "WEBHOOK_INVALID_MERCHANT",
          "Invalid or missing merchantId in payload",
        );
      }

      const [inboxEvent] = await InboxEvent.create(
        [
          {
            source: "mock-provider",
            providerEventId,
            eventType: payload.type,
            paymentId: payload.paymentId
              ? new mongoose.Types.ObjectId(payload.paymentId)
              : null,
            refundId: payload.refundId
              ? new mongoose.Types.ObjectId(payload.refundId)
              : null,
            merchantId: new mongoose.Types.ObjectId(merchantId),
            payload,
            payloadDigest,
            signatureVerified: true,
            processingStatus: "PENDING",
            isDemo: payload.isDemo ?? false,
          },
        ],
        { session },
      );

      await processInboxEvent({
        inboxEventId: inboxEvent._id,
        session,
        config,
        logger,
      });

      return { inboxEvent, duplicate: false };
    });
  } finally {
    await session.endSession();
  }
}

async function processInboxEvent({ inboxEventId, session, config, logger }) {
  const inboxEvent = await InboxEvent.findById(inboxEventId).session(session);
  if (!inboxEvent) return;

  await InboxEvent.updateOne(
    { _id: inboxEventId },
    { $set: { processingStatus: "PROCESSING" } },
    { session },
  );

  try {
    const payload = inboxEvent.payload;
    const orchestrator = await createPaymentOrchestratorService(config, logger);

    const auth = {
      merchantId: inboxEvent.merchantId,
      isDemo: inboxEvent.isDemo,
      role: "webhook",
      config,
      logger,
    };

    if (inboxEvent.eventType === "authorization.completed") {
      if (payload.providerOperationId) {
        await orchestrator.reconcileAuthorization({
          providerOperationId: payload.providerOperationId,
          auth,
        });
      }
    } else if (inboxEvent.eventType === "capture.completed") {
      if (payload.providerOperationId) {
        await orchestrator.reconcileCapture({
          providerOperationId: payload.providerOperationId,
          auth,
        });
      }
    } else if (inboxEvent.eventType === "refund.completed") {
      if (payload.providerOperationId) {
        await orchestrator.reconcileRefund({
          providerOperationId: payload.providerOperationId,
          auth,
        });
      }
    }

    await InboxEvent.updateOne(
      { _id: inboxEventId },
      { $set: { processingStatus: "COMPLETED", processedAt: new Date() } },
      { session },
    );
  } catch (error) {
    await InboxEvent.updateOne(
      { _id: inboxEventId },
      {
        $set: { processingStatus: "FAILED", lastError: error.message },
        $inc: { attemptCount: 1 },
      },
      { session },
    );
    throw error;
  }
}

export async function getInboxEvents({ merchantId, query }) {
  const filter = { merchantId };
  if (query.status) filter.processingStatus = query.status;
  if (query.eventType) filter.eventType = query.eventType;
  if (query.from || query.to) {
    filter.receivedAt = {};
    if (query.from) filter.receivedAt.$gte = new Date(query.from);
    if (query.to) filter.receivedAt.$lte = new Date(query.to);
  }

  const limit = Math.min(query.limit ?? 20, 100);
  const events = await InboxEvent.find(filter)
    .sort({ receivedAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return { events, count: events.length };
}

export async function retryInboxEvent({
  inboxEventId,
  merchantId,
  config,
  logger,
}) {
  const inboxEvent = await InboxEvent.findOne({
    _id: inboxEventId,
    merchantId,
  });
  if (!inboxEvent) {
    throw new AppError(404, "INBOX_EVENT_NOT_FOUND", "Inbox event not found");
  }

  if (inboxEvent.processingStatus !== "FAILED") {
    throw new AppError(
      409,
      "INBOX_EVENT_NOT_FAILED",
      "Can only retry failed events",
    );
  }

  await InboxEvent.updateOne(
    { _id: inboxEventId },
    { $set: { processingStatus: "PENDING" } },
  );

  return processInboxEvent({ inboxEventId, config, logger });
}

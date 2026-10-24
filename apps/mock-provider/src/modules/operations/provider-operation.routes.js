import express from "express";
import { z } from "zod";
import {
  createAuthorization,
  createCapture,
  createRefund,
  getOperation,
  listOperations,
} from "./provider-operation.service.js";
import { validate } from "../../../api/src/middleware/validate.js";

const router = express.Router();

const amountMinorSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, "amountMinor must be a positive integer digit string")
  .refine((v) => BigInt(v) > 0n && BigInt(v) <= 1_000_000_000_000n, "Amount out of range");

const currencySchema = z.enum(["USD", "INR"]);

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[\x21-\x7E]+$/);

const clientOperationIdSchema = z.string().trim().min(1).max(64);

const merchantIdSchema = z.string().trim().min(1).max(64);

const providerReferenceSchema = z.string().trim().min(1).max(100).optional();

const metadataSchema = z
  .record(z.string().trim().max(200))
  .refine((v) => Object.keys(v).length <= 10, "Max 10 metadata entries")
  .optional();

const authorizeSchema = z
  .object({
    clientOperationId: clientOperationIdSchema,
    amountMinor: amountMinorSchema,
    currency: currencySchema,
    idempotencyKey: idempotencyKeySchema,
    merchantId: merchantIdSchema,
    paymentMethod: z.object({
      type: z.enum(["card", "bank_transfer", "wallet"]),
      token: z.string().trim().min(1).max(100),
    }),
    description: z.string().trim().max(500).optional(),
    metadata: metadataSchema,
  })
  .strict();

const captureSchema = z
  .object({
    clientOperationId: clientOperationIdSchema,
    authorizationOperationId: z.string().trim().min(1).max(64),
    amountMinor: amountMinorSchema,
    currency: currencySchema,
    idempotencyKey: idempotencyKeySchema,
    merchantId: merchantIdSchema,
    metadata: metadataSchema,
  })
  .strict();

const refundSchema = z
  .object({
    clientOperationId: clientOperationIdSchema,
    captureOperationId: z.string().trim().min(1).max(64),
    amountMinor: amountMinorSchema,
    currency: currencySchema,
    idempotencyKey: idempotencyKeySchema,
    merchantId: merchantIdSchema,
    reason: z.string().trim().min(1).max(240).optional(),
    metadata: metadataSchema,
  })
  .strict();

const listQuerySchema = z
  .object({
    type: z.enum(["AUTHORIZATION", "CAPTURE", "REFUND", "VOID"]).optional(),
    status: z.enum(["RECEIVED", "PROCESSING", "SUCCEEDED", "DECLINED", "UNKNOWN_TO_CLIENT"]).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

router.post("/v1/authorizations", validate(authorizeSchema), async (req, res, next) => {
  try {
    const config = req.app.locals.config;
    const session = req.app.locals.mongooseSession;
    const result = await createAuthorization({
      body: req.body,
      config,
      session,
      isDemo: req.body.isDemo ?? false,
    });
    const statusCode = result.timeout ? 202 : result.idempotent ? 200 : 201;
    res.status(statusCode).json({
      data: {
        operationId: result.operation.operationId,
        type: result.operation.type,
        status: result.operation.status,
        statusReason: result.operation.statusReason,
        providerReference: result.operation.providerReference,
        amountMinor: result.operation.amountMinor?.toString?.() ?? result.operation.amountMinor,
        currency: result.operation.currency,
        clientOperationId: result.operation.clientOperationId,
        idempotent: result.idempotent,
        timeout: result.timeout ?? false,
        createdAt: result.operation.createdAt,
        completedAt: result.operation.processingCompletedAt,
      },
      meta: { requestId: req.requestId },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/v1/captures", validate(captureSchema), async (req, res, next) => {
  try {
    const config = req.app.locals.config;
    const session = req.app.locals.mongooseSession;
    const result = await createCapture({
      body: req.body,
      config,
      session,
      isDemo: req.body.isDemo ?? false,
    });
    const statusCode = result.timeout ? 202 : result.idempotent ? 200 : 201;
    res.status(statusCode).json({
      data: {
        operationId: result.operation.operationId,
        type: result.operation.type,
        status: result.operation.status,
        statusReason: result.operation.statusReason,
        providerReference: result.operation.providerReference,
        amountMinor: result.operation.amountMinor?.toString?.() ?? result.operation.amountMinor,
        currency: result.operation.currency,
        clientOperationId: result.operation.clientOperationId,
        idempotent: result.idempotent,
        timeout: result.timeout ?? false,
        createdAt: result.operation.createdAt,
        completedAt: result.operation.processingCompletedAt,
      },
      meta: { requestId: req.requestId },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/v1/refunds", validate(refundSchema), async (req, res, next) => {
  try {
    const config = req.app.locals.config;
    const session = req.app.locals.mongooseSession;
    const result = await createRefund({
      body: req.body,
      config,
      session,
      isDemo: req.body.isDemo ?? false,
    });
    const statusCode = result.timeout ? 202 : result.idempotent ? 200 : 201;
    res.status(statusCode).json({
      data: {
        operationId: result.operation.operationId,
        type: result.operation.type,
        status: result.operation.status,
        statusReason: result.operation.statusReason,
        providerReference: result.operation.providerReference,
        amountMinor: result.operation.amountMinor?.toString?.() ?? result.operation.amountMinor,
        currency: result.operation.currency,
        clientOperationId: result.operation.clientOperationId,
        idempotent: result.idempotent,
        timeout: result.timeout ?? false,
        createdAt: result.operation.createdAt,
        completedAt: result.operation.processingCompletedAt,
      },
      meta: { requestId: req.requestId },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/v1/operations/:operationId", async (req, res, next) => {
  try {
    const session = req.app.locals.mongooseSession;
    const operation = await getOperation({ operationId: req.params.operationId, session });
    res.json({
      data: {
        operationId: operation.operationId,
        type: operation.type,
        status: operation.status,
        statusReason: operation.statusReason,
        providerReference: operation.providerReference,
        amountMinor: operation.amountMinor?.toString?.() ?? operation.amountMinor,
        currency: operation.currency,
        clientOperationId: operation.clientOperationId,
        merchantId: operation.merchantId,
        requestPayload: operation.requestPayload,
        responsePayload: operation.responsePayload,
        faultInjected: operation.faultInjected,
        createdAt: operation.createdAt,
        processingStartedAt: operation.processingStartedAt,
        processingCompletedAt: operation.processingCompletedAt,
      },
      meta: { requestId: req.requestId },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/v1/operations", validate(listQuerySchema), async (req, res, next) => {
  try {
    const session = req.app.locals.mongooseSession;
    const merchantId = req.query.merchantId ?? req.headers["x-merchant-id"];
    if (!merchantId) {
      return res.status(400).json({
        error: { code: "MERCHANT_ID_REQUIRED", message: "merchantId query param or x-merchant-id header required" },
        meta: { requestId: req.requestId },
      });
    }
    const result = await listOperations({ merchantId, query: req.query, session });
    res.json({
      data: {
        operations: result.operations.map((op) => ({
          operationId: op.operationId,
          type: op.type,
          status: op.status,
          providerReference: op.providerReference,
          amountMinor: op.amountMinor?.toString?.() ?? op.amountMinor,
          currency: op.currency,
          clientOperationId: op.clientOperationId,
          createdAt: op.createdAt,
          processingCompletedAt: op.processingCompletedAt,
        })),
        count: result.count,
      },
      meta: { requestId: req.requestId },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
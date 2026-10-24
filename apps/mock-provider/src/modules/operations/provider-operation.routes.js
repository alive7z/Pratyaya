
import express from "express";
import { z } from "zod";
import {
  createAuthorization,
  createCapture,
  createRefund,
  getOperation,
  listOperations,
} from "./provider-operation.service.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../lib/errors.js";

const router = express.Router();

const amountMinorSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Amount must be a positive integer string")
  .refine(
    (value) => BigInt(value) <= 1_000_000_000_000n,
    "Amount exceeds the allowed limit",
  );

const currencySchema = z.enum(["USD", "INR"]);
const operationIdSchema = z.string().trim().min(1).max(64);
const merchantIdSchema = z.string().trim().min(1).max(64);

const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(255)
  .regex(/^[\x21-\x7E]+$/, "Invalid idempotency key");

const metadataSchema = z
  .record(z.string().trim().max(200))
  .refine(
    (value) => Object.keys(value).length <= 10,
    "Maximum 10 metadata entries allowed",
  )
  .optional();

const baseOperationSchema = {
  clientOperationId: operationIdSchema,
  merchantId: merchantIdSchema,
  amountMinor: amountMinorSchema,
  currency: currencySchema,
  idempotencyKey: idempotencyKeySchema,
  metadata: metadataSchema,
};

const authorizationSchema = z
  .object({
    ...baseOperationSchema,
    paymentMethod: z
      .object({
        type: z.enum(["card", "bank_transfer", "wallet"]),
        token: z.string().trim().min(1).max(100),
      })
      .strict(),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

const captureSchema = z
  .object({
    ...baseOperationSchema,
    authorizationOperationId: operationIdSchema,
  })
  .strict();

const refundSchema = z
  .object({
    ...baseOperationSchema,
    captureOperationId: operationIdSchema,
    reason: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

const operationParamsSchema = z
  .object({
    operationId: operationIdSchema,
  })
  .strict();

const listQuerySchema = z
  .object({
    merchantId: merchantIdSchema.optional(),
    type: z.enum(["AUTHORIZATION", "CAPTURE", "REFUND", "VOID"]).optional(),
    status: z
      .enum([
        "RECEIVED",
        "PROCESSING",
        "SUCCEEDED",
        "DECLINED",
        "UNKNOWN_TO_CLIENT",
      ])
      .optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine(
    (query) => !query.from || !query.to || query.from <= query.to,
    {
      message: "from must not be later than to",
      path: ["from"],
    },
  );

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch(next);
  };
}

function serializeOperation(operation, detailed = false) {
  const result = {
    operationId: operation.operationId,
    type: operation.type,
    status: operation.status,
    statusReason: operation.statusReason ?? null,
    providerReference: operation.providerReference ?? null,
    amountMinor: operation.amountMinor?.toString() ?? null,
    currency: operation.currency,
    clientOperationId: operation.clientOperationId,
    createdAt: operation.createdAt,
    processingCompletedAt: operation.processingCompletedAt ?? null,
  };

  if (detailed) {
    Object.assign(result, {
      merchantId: operation.merchantId,
      requestPayload: operation.requestPayload,
      responsePayload: operation.responsePayload ?? null,
      faultInjected: operation.faultInjected ?? null,
      processingStartedAt: operation.processingStartedAt ?? null,
    });
  }

  return result;
}

function sendOperationResult(req, res, result) {
  const statusCode = result.timeout
    ? 202
    : result.idempotent
      ? 200
      : 201;

  return res.status(statusCode).json({
    data: {
      ...serializeOperation(result.operation),
      idempotent: Boolean(result.idempotent),
      timeout: Boolean(result.timeout),
      completedAt: result.operation.processingCompletedAt ?? null,
    },
    meta: {
      requestId: req.requestId,
    },
  });
}

function createOperationHandler(service) {
  return asyncHandler(async (req, res) => {
    const result = await service({
      body: req.validated.body,
      providerConfig: req.providerConfig,
      isDemo: false,
    });

    return sendOperationResult(req, res, result);
  });
}

router.post(
  "/v1/authorizations",
  validate({ body: authorizationSchema }),
  createOperationHandler(createAuthorization),
);

router.post(
  "/v1/captures",
  validate({ body: captureSchema }),
  createOperationHandler(createCapture),
);

router.post(
  "/v1/refunds",
  validate({ body: refundSchema }),
  createOperationHandler(createRefund),
);

router.get(
  "/v1/operations/:operationId",
  validate({ params: operationParamsSchema }),
  asyncHandler(async (req, res) => {
    const operation = await getOperation({
      operationId: req.validated.params.operationId,
      providerId: req.providerConfig.providerId,
    });

    if (!operation) {
      throw new AppError(
        404,
        "PROVIDER_OPERATION_NOT_FOUND",
        "Provider operation not found",
      );
    }

    return res.status(200).json({
      data: serializeOperation(operation, true),
      meta: {
        requestId: req.requestId,
      },
    });
  }),
);

router.get(
  "/v1/operations",
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { merchantId: queryMerchantId, ...filters } = req.validated.query;

    const headerMerchantId = req.get("X-Merchant-ID")?.trim();

    const parsedMerchantId = merchantIdSchema.safeParse(
      queryMerchantId ?? headerMerchantId,
    );

    if (!parsedMerchantId.success) {
      throw new AppError(
        400,
        "MERCHANT_ID_REQUIRED",
        "A valid merchantId query parameter or X-Merchant-ID header is required",
      );
    }

    const merchantId = parsedMerchantId.data;

    if (
      queryMerchantId &&
      headerMerchantId &&
      queryMerchantId !== headerMerchantId
    ) {
      throw new AppError(
        400,
        "MERCHANT_ID_MISMATCH",
        "Merchant identifiers in query and headers must match",
      );
    }

    const result = await listOperations({
      merchantId,
      providerId: req.providerConfig.providerId,
      query: filters,
    });

    const operations = Array.isArray(result?.operations)
      ? result.operations
      : [];

    return res.status(200).json({
      data: {
        operations: operations.map((operation) =>
          serializeOperation(operation),
        ),
        count: result?.count ?? operations.length,
      },
      meta: {
        requestId: req.requestId,
      },
    });
  }),
);

export default router;

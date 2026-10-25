import { createHash, randomUUID } from "node:crypto";
import {
  ProviderOperation,
  PROVIDER_OPERATION_STATUS,
  PROVIDER_OPERATION_TYPES,
} from "./provider-operation.model.js";
import { AppError } from "../../lib/errors.js";

const { AUTHORIZATION, CAPTURE, REFUND } = PROVIDER_OPERATION_TYPES;
const { RECEIVED, PROCESSING, SUCCEEDED, DECLINED, UNKNOWN_TO_CLIENT } =
  PROVIDER_OPERATION_STATUS;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hashPayload(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function getFault(providerConfig, body) {
  if (body?.simulationFault && providerConfig?.allowRequestFaults) {
    return body.simulationFault;
  }

  if (!providerConfig?.faults?.enabled) return null;

  return (
    providerConfig.faults.rules?.find(
      (rule) =>
        rule.enabled === true &&
        (!rule.providerId ||
          rule.providerId === "all" ||
          rule.providerId === providerConfig.providerId),
    ) ?? null
  );
}

async function applyFault(fault) {
  if (!fault) return null;

  switch (fault.type) {
    case "timeout":
      await sleep(fault.delayMs ?? 30000);
      return { type: "timeout" };

    case "latency":
      await sleep(fault.delayMs ?? 2000);
      return { type: "latency" };

    case "decline":
      return {
        type: "decline",
        code: fault.code ?? "PROVIDER_DECLINED",
        message: fault.message ?? "Simulated provider decline",
      };

    case "error":
      throw new AppError(
        fault.statusCode ?? 500,
        fault.code ?? "PROVIDER_ERROR",
        fault.message ?? "Simulated provider error",
      );

    default:
      return null;
  }
}

function getRequestPayload(type, body) {
  const { clientOperationId, amountMinor, currency, metadata } = body;

  const payload = {
    clientOperationId,
    amountMinor,
    currency,
    metadata,
  };

  if (type === AUTHORIZATION) {
    payload.paymentMethod = body.paymentMethod;
    payload.description = body.description;
  }

  if (type === CAPTURE) {
    payload.authorizationOperationId = body.authorizationOperationId;
  }

  if (type === REFUND) {
    payload.captureOperationId = body.captureOperationId;
    payload.reason = body.reason;
  }

  return payload;
}

function getFingerprint(type, body) {
  const payload = {
    type,
    merchantId: body.merchantId,
    clientOperationId: body.clientOperationId,
    amountMinor: body.amountMinor,
    currency: body.currency,
  };

  if (type === AUTHORIZATION) {
    payload.paymentMethod = body.paymentMethod;
  }

  if (type === CAPTURE) {
    payload.authorizationOperationId = body.authorizationOperationId;
  }

  if (type === REFUND) {
    payload.captureOperationId = body.captureOperationId;
  }

  return hashPayload(payload);
}

async function findExisting({
  type,
  providerId,
  idempotencyKey,
  fingerprint,
  session,
}) {
  const existing = await ProviderOperation.findOne({
    providerId,
    type,
    idempotencyKey,
  })
    .session(session ?? null)
    .lean();

  if (!existing) return null;

  if (existing.requestFingerprint !== fingerprint) {
    throw new AppError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "Idempotency key was already used with a different request",
      { operationId: existing.operationId },
    );
  }

  return existing;
}

async function validateParentOperation({ type, body, providerId, session }) {
  if (type === AUTHORIZATION) return;

  const parentType = type === CAPTURE ? AUTHORIZATION : CAPTURE;

  const parentOperationId =
    type === CAPTURE ? body.authorizationOperationId : body.captureOperationId;

  const parent = await ProviderOperation.findOne({
    operationId: parentOperationId,
    providerId,
    merchantId: body.merchantId,
    type: parentType,
  })
    .session(session ?? null)
    .lean();

  if (!parent) {
    throw new AppError(
      404,
      "PARENT_OPERATION_NOT_FOUND",
      "Referenced provider operation was not found",
    );
  }

  if (parent.status !== SUCCEEDED) {
    throw new AppError(
      409,
      "PARENT_OPERATION_NOT_SUCCEEDED",
      "Referenced provider operation has not succeeded",
    );
  }

  if (parent.currency !== body.currency) {
    throw new AppError(
      409,
      "CURRENCY_MISMATCH",
      "Operation currency does not match the original operation",
    );
  }

  const parentAmount = BigInt(parent.amountMinor);
  const requestedAmount = BigInt(body.amountMinor);

  if (requestedAmount > parentAmount) {
    throw new AppError(
      409,
      "AMOUNT_EXCEEDS_PARENT",
      "Requested amount exceeds the original operation amount",
    );
  }

  const relatedType = type;

  const relatedField =
    type === CAPTURE
      ? "requestPayload.authorizationOperationId"
      : "requestPayload.captureOperationId";

  const related = await ProviderOperation.find({
    providerId,
    merchantId: body.merchantId,
    type: relatedType,
    [relatedField]: parentOperationId,
    status: {
      $in: [RECEIVED, PROCESSING, SUCCEEDED, UNKNOWN_TO_CLIENT],
    },
  })
    .session(session ?? null)
    .select("amountMinor")
    .lean();

  const reservedAmount = related.reduce(
    (total, operation) => total + BigInt(operation.amountMinor),
    0n,
  );

  if (reservedAmount + requestedAmount > parentAmount) {
    throw new AppError(
      409,
      type === CAPTURE ? "CAPTURE_AMOUNT_EXCEEDED" : "REFUND_AMOUNT_EXCEEDED",
      type === CAPTURE
        ? "Capture amount exceeds the remaining authorized amount"
        : "Refund amount exceeds the remaining captured amount",
    );
  }
}

async function updateOperation(operationId, changes, session) {
  const operation = await ProviderOperation.findOneAndUpdate(
    { operationId },
    { $set: changes },
    {
      returnDocument: "after",
      runValidators: true,
      session: session ?? null,
    },
  ).lean();

  if (!operation) {
    throw new AppError(
      404,
      "OPERATION_NOT_FOUND",
      "Provider operation not found",
    );
  }

  return operation;
}

function createSuccessResponse(type, body, providerReference) {
  const response = {
    providerReference,
    amountMinor: body.amountMinor,
    currency: body.currency,
  };

  if (type === AUTHORIZATION) {
    return { authorized: true, ...response };
  }

  if (type === CAPTURE) {
    return {
      captured: true,
      ...response,
      authorizationOperationId: body.authorizationOperationId,
    };
  }

  return {
    refunded: true,
    ...response,
    captureOperationId: body.captureOperationId,
  };
}

async function createOperation({
  type,
  body,
  providerConfig,
  session,
  isDemo = false,
}) {
  if (!providerConfig?.providerId) {
    throw new AppError(
      500,
      "PROVIDER_NOT_CONFIGURED",
      "Provider configuration is missing",
    );
  }

  const providerId = providerConfig.providerId;
  const fingerprint = getFingerprint(type, body);

  const existing = await findExisting({
    type,
    providerId,
    idempotencyKey: body.idempotencyKey,
    fingerprint,
    session,
  });

  if (existing) {
    return {
      operation: existing,
      idempotent: true,
      timeout: existing.status === UNKNOWN_TO_CLIENT,
    };
  }

  await validateParentOperation({
    type,
    body,
    providerId,
    session,
  });

  const operationId = body.clientOperationId;
  const requestPayload = getRequestPayload(type, body);

  try {
    await ProviderOperation.create(
      [
        {
          providerId,
          operationId,
          type,
          clientOperationId: body.clientOperationId,
          merchantId: body.merchantId,
          amountMinor: BigInt(body.amountMinor),
          currency: body.currency,
          status: RECEIVED,
          requestPayload,
          idempotencyKey: body.idempotencyKey,
          requestFingerprint: fingerprint,
          isDemo: Boolean(isDemo),
        },
      ],
      session ? { session } : {},
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const replay = await findExisting({
      type,
      providerId,
      idempotencyKey: body.idempotencyKey,
      fingerprint,
      session,
    });

    if (replay) {
      return {
        operation: replay,
        idempotent: true,
        timeout: replay.status === UNKNOWN_TO_CLIENT,
      };
    }

    throw new AppError(
      409,
      "OPERATION_CONFLICT",
      "An operation with this identifier already exists",
    );
  }

  await updateOperation(
    operationId,
    {
      status: PROCESSING,
      processingStartedAt: new Date(),
    },
    session,
  );

  const fault = getFault(providerConfig, body);
  let faultResult;

  try {
    faultResult = await applyFault(fault);
  } catch (error) {
    await updateOperation(
      operationId,
      {
        status: UNKNOWN_TO_CLIENT,
        statusReason: "Provider processing error; reconciliation required",
        faultInjected: fault?.type ?? null,
        processingCompletedAt: new Date(),
      },
      session,
    );

    throw error;
  }

  if (faultResult?.type === "timeout") {
    const updated = await updateOperation(
      operationId,
      {
        status: UNKNOWN_TO_CLIENT,
        statusReason: "Provider timeout; outcome unknown to client",
        faultInjected: "timeout",
        processingCompletedAt: new Date(),
      },
      session,
    );

    return {
      operation: updated,
      idempotent: false,
      timeout: true,
    };
  }

  const declined = faultResult?.type === "decline";
  const providerReference = declined
    ? null
    : `PROV-${randomUUID().slice(0, 12).toUpperCase()}`;

  const responsePayload = declined
    ? {
        declined: true,
        code: faultResult.code,
        message: faultResult.message,
      }
    : createSuccessResponse(type, body, providerReference);

  const updated = await updateOperation(
    operationId,
    {
      status: declined ? DECLINED : SUCCEEDED,
      statusReason: declined ? faultResult.message : null,
      responsePayload,
      providerReference,
      faultInjected: faultResult?.type ?? null,
      processingCompletedAt: new Date(),
    },
    session,
  );

  return {
    operation: updated,
    idempotent: false,
    timeout: false,
  };
}

export function createAuthorization(options) {
  return createOperation({
    ...options,
    type: AUTHORIZATION,
  });
}

export function createCapture(options) {
  return createOperation({
    ...options,
    type: CAPTURE,
  });
}

export function createRefund(options) {
  return createOperation({
    ...options,
    type: REFUND,
  });
}

export async function getOperation({ operationId, providerId, session }) {
  let operation = await ProviderOperation.findOne({
    operationId,
    providerId,
  })
    .session(session ?? null)
    .lean();

  if (!operation) {
    throw new AppError(
      404,
      "OPERATION_NOT_FOUND",
      "Provider operation not found",
    );
  }

  if (
    operation.status === UNKNOWN_TO_CLIENT &&
    operation.faultInjected === "timeout"
  ) {
    const providerReference = `PROV-${randomUUID().slice(0, 12).toUpperCase()}`;
    operation = await updateOperation(
      operationId,
      {
        status: SUCCEEDED,
        statusReason: null,
        responsePayload: createSuccessResponse(
          operation.type,
          {
            ...operation.requestPayload,
            amountMinor: operation.amountMinor.toString(),
            currency: operation.currency,
          },
          providerReference,
        ),
        providerReference,
        processingCompletedAt: new Date(),
      },
      session,
    );
  }

  return operation;
}

export async function listOperations({
  merchantId,
  providerId,
  query = {},
  session,
}) {
  const filter = { merchantId, providerId };

  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;

  if (query.from || query.to) {
    filter.createdAt = {};

    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

  const operations = await ProviderOperation.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .session(session ?? null)
    .lean();

  return {
    operations,
    count: operations.length,
  };
}

export { PROVIDER_OPERATION_TYPES, PROVIDER_OPERATION_STATUS };

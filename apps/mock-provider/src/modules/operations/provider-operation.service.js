import { createHash, randomUUID } from "node:crypto";
import {
  ProviderOperation,
  PROVIDER_OPERATION_STATUS,
  PROVIDER_OPERATION_TYPES,
} from "./provider-operation.model.js";
import { AppError } from "../../lib/errors.js";

function hashPayload(payload) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 64);
}

function getFaultConfig(providerConfig) {
  if (!providerConfig?.faults?.enabled) return null;
  const faults = providerConfig.faults.rules ?? [];
  return faults.find((f) => f.enabled === true) ?? null;
}

async function applyFault(fault) {
  if (!fault) return null;

  switch (fault.type) {
    case "timeout": {
      const delayMs = fault.delayMs ?? 30000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return {
        type: "timeout",
        message: "Simulated provider timeout",
      };
    }
    case "latency": {
      const delayMs = fault.delayMs ?? 2000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return null;
    }
    case "decline": {
      return {
        type: "decline",
        message: fault.message ?? "Simulated provider decline",
        code: fault.code ?? "PROVIDER_DECLINED",
      };
    }
    case "error": {
      throw new AppError(
        fault.statusCode ?? 500,
        fault.code ?? "PROVIDER_ERROR",
        fault.message ?? "Simulated provider error",
      );
    }
    default:
      return null;
  }
}

export async function createAuthorization({
  body,
  providerConfig,
  session,
  isDemo,
}) {
  const {
    clientOperationId,
    amountMinor,
    currency,
    idempotencyKey,
    merchantId,
    paymentMethod,
    description,
    metadata,
  } = body;

  const requestPayload = {
    clientOperationId,
    amountMinor,
    currency,
    paymentMethod,
    description,
    metadata,
  };

  const fingerprint = hashPayload({
    clientOperationId,
    amountMinor,
    currency,
    paymentMethod,
  });

  const existing = await ProviderOperation.findOne(
    { idempotencyKey, type: PROVIDER_OPERATION_TYPES.AUTHORIZATION },
    null,
    { session },
  ).lean();

  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      throw new AppError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Idempotency key used with different request payload",
        { operationId: existing.operationId },
      );
    }
    return { operation: existing, idempotent: true };
  }

  const operationId = `op_${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  const fault = getFaultConfig(providerConfig);
  let status = PROVIDER_OPERATION_STATUS.RECEIVED;
  let statusReason = null;
  let responsePayload = null;
  let providerReference = null;
  let faultInjected = null;

  const [operation] = await ProviderOperation.create(
    [
      {
        operationId,
        type: PROVIDER_OPERATION_TYPES.AUTHORIZATION,
        clientOperationId,
        merchantId,
        amountMinor: BigInt(amountMinor),
        currency,
        status,
        requestPayload,
        idempotencyKey,
        requestFingerprint: fingerprint,
        isDemo,
      },
    ],
    { session },
  );

  await ProviderOperation.updateOne(
    { _id: operation._id },
    {
      $set: {
        status: PROVIDER_OPERATION_STATUS.PROCESSING,
        processingStartedAt: new Date(),
      },
    },
    { session },
  );

  const faultResult = await applyFault(fault);

  if (faultResult?.type === "timeout") {
    await ProviderOperation.updateOne(
      { _id: operation._id },
      {
        $set: {
          status: PROVIDER_OPERATION_STATUS.UNKNOWN_TO_CLIENT,
          statusReason: "Provider timeout - outcome unknown to client",
          processingCompletedAt: new Date(),
          faultInjected: "timeout",
        },
      },
      { session },
    );
    const updated = await ProviderOperation.findById(operation._id)
      .session(session)
      .lean();
    return { operation: updated, idempotent: false, timeout: true };
  }

  if (faultResult?.type === "decline") {
    status = PROVIDER_OPERATION_STATUS.DECLINED;
    statusReason = faultResult.message;
    responsePayload = {
      declined: true,
      code: faultResult.code,
      message: faultResult.message,
    };
    faultInjected = "decline";
  } else {
    status = PROVIDER_OPERATION_STATUS.SUCCEEDED;
    providerReference = `PROV-${randomUUID().slice(0, 12).toUpperCase()}`;
    responsePayload = {
      authorized: true,
      providerReference,
      amountMinor,
      currency,
    };
  }

  await ProviderOperation.updateOne(
    { _id: operation._id },
    {
      $set: {
        status,
        statusReason,
        responsePayload,
        providerReference,
        processingCompletedAt: new Date(),
        faultInjected,
      },
    },
    { session },
  );

  const updated = await ProviderOperation.findById(operation._id)
    .session(session)
    .lean();
  return { operation: updated, idempotent: false };
}

export async function createCapture({ body, providerConfig, session, isDemo }) {
  const {
    clientOperationId,
    authorizationOperationId,
    amountMinor,
    currency,
    idempotencyKey,
    merchantId,
    metadata,
  } = body;

  const requestPayload = {
    clientOperationId,
    authorizationOperationId,
    amountMinor,
    currency,
    metadata,
  };

  const fingerprint = hashPayload({
    clientOperationId,
    authorizationOperationId,
    amountMinor,
    currency,
  });

  const existing = await ProviderOperation.findOne(
    { idempotencyKey, type: PROVIDER_OPERATION_TYPES.CAPTURE },
    null,
    { session },
  ).lean();

  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      throw new AppError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Idempotency key used with different request payload",
        { operationId: existing.operationId },
      );
    }
    return { operation: existing, idempotent: true };
  }

  const operationId = `op_${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  const fault = getFaultConfig(providerConfig);
  let status = PROVIDER_OPERATION_STATUS.RECEIVED;
  let statusReason = null;
  let responsePayload = null;
  let providerReference = null;
  let faultInjected = null;

  const [operation] = await ProviderOperation.create(
    [
      {
        operationId,
        type: PROVIDER_OPERATION_TYPES.CAPTURE,
        clientOperationId,
        merchantId,
        amountMinor: BigInt(amountMinor),
        currency,
        status,
        requestPayload,
        idempotencyKey,
        requestFingerprint: fingerprint,
        isDemo,
      },
    ],
    { session },
  );

  await ProviderOperation.updateOne(
    { _id: operation._id },
    {
      $set: {
        status: PROVIDER_OPERATION_STATUS.PROCESSING,
        processingStartedAt: new Date(),
      },
    },
    { session },
  );

  const faultResult = await applyFault(fault);

  if (faultResult?.type === "timeout") {
    await ProviderOperation.updateOne(
      { _id: operation._id },
      {
        $set: {
          status: PROVIDER_OPERATION_STATUS.UNKNOWN_TO_CLIENT,
          statusReason: "Provider timeout - outcome unknown to client",
          processingCompletedAt: new Date(),
          faultInjected: "timeout",
        },
      },
      { session },
    );
    const updated = await ProviderOperation.findById(operation._id)
      .session(session)
      .lean();
    return { operation: updated, idempotent: false, timeout: true };
  }

  if (faultResult?.type === "decline") {
    status = PROVIDER_OPERATION_STATUS.DECLINED;
    statusReason = faultResult.message;
    responsePayload = {
      captured: false,
      code: faultResult.code,
      message: faultResult.message,
    };
    faultInjected = "decline";
  } else {
    status = PROVIDER_OPERATION_STATUS.SUCCEEDED;
    providerReference = `PROV-${randomUUID().slice(0, 12).toUpperCase()}`;
    responsePayload = {
      captured: true,
      providerReference,
      amountMinor,
      currency,
      authorizationOperationId,
    };
  }

  await ProviderOperation.updateOne(
    { _id: operation._id },
    {
      $set: {
        status,
        statusReason,
        responsePayload,
        providerReference,
        processingCompletedAt: new Date(),
        faultInjected,
      },
    },
    { session },
  );

  const updated = await ProviderOperation.findById(operation._id)
    .session(session)
    .lean();
  return { operation: updated, idempotent: false };
}

export async function createRefund({ body, providerConfig, session, isDemo }) {
  const {
    clientOperationId,
    captureOperationId,
    amountMinor,
    currency,
    idempotencyKey,
    merchantId,
    reason,
    metadata,
  } = body;

  const requestPayload = {
    clientOperationId,
    captureOperationId,
    amountMinor,
    currency,
    reason,
    metadata,
  };

  const fingerprint = hashPayload({
    clientOperationId,
    captureOperationId,
    amountMinor,
    currency,
  });

  const existing = await ProviderOperation.findOne(
    { idempotencyKey, type: PROVIDER_OPERATION_TYPES.REFUND },
    null,
    { session },
  ).lean();

  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      throw new AppError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Idempotency key used with different request payload",
        { operationId: existing.operationId },
      );
    }
    return { operation: existing, idempotent: true };
  }

  const operationId = `op_${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  const fault = getFaultConfig(providerConfig);
  let status = PROVIDER_OPERATION_STATUS.RECEIVED;
  let statusReason = null;
  let responsePayload = null;
  let providerReference = null;
  let faultInjected = null;

  const [operation] = await ProviderOperation.create(
    [
      {
        operationId,
        type: PROVIDER_OPERATION_TYPES.REFUND,
        clientOperationId,
        merchantId,
        amountMinor: BigInt(amountMinor),
        currency,
        status,
        requestPayload,
        idempotencyKey,
        requestFingerprint: fingerprint,
        isDemo,
      },
    ],
    { session },
  );

  await ProviderOperation.updateOne(
    { _id: operation._id },
    {
      $set: {
        status: PROVIDER_OPERATION_STATUS.PROCESSING,
        processingStartedAt: new Date(),
      },
    },
    { session },
  );

  const faultResult = await applyFault(fault);

  if (faultResult?.type === "timeout") {
    await ProviderOperation.updateOne(
      { _id: operation._id },
      {
        $set: {
          status: PROVIDER_OPERATION_STATUS.UNKNOWN_TO_CLIENT,
          statusReason: "Provider timeout - outcome unknown to client",
          processingCompletedAt: new Date(),
          faultInjected: "timeout",
        },
      },
      { session },
    );
    const updated = await ProviderOperation.findById(operation._id)
      .session(session)
      .lean();
    return { operation: updated, idempotent: false, timeout: true };
  }

  if (faultResult?.type === "decline") {
    status = PROVIDER_OPERATION_STATUS.DECLINED;
    statusReason = faultResult.message;
    responsePayload = {
      refunded: false,
      code: faultResult.code,
      message: faultResult.message,
    };
    faultInjected = "decline";
  } else {
    status = PROVIDER_OPERATION_STATUS.SUCCEEDED;
    providerReference = `PROV-${randomUUID().slice(0, 12).toUpperCase()}`;
    responsePayload = {
      refunded: true,
      providerReference,
      amountMinor,
      currency,
      captureOperationId,
    };
  }

  await ProviderOperation.updateOne(
    { _id: operation._id },
    {
      $set: {
        status,
        statusReason,
        responsePayload,
        providerReference,
        processingCompletedAt: new Date(),
        faultInjected,
      },
    },
    { session },
  );

  const updated = await ProviderOperation.findById(operation._id)
    .session(session)
    .lean();
  return { operation: updated, idempotent: false };
}

export async function getOperation({ operationId, session }) {
  const operation = await ProviderOperation.findOne({ operationId })
    .session(session)
    .lean();
  if (!operation) {
    throw new AppError(
      404,
      "OPERATION_NOT_FOUND",
      "Provider operation not found",
    );
  }
  return operation;
}

export async function listOperations({ merchantId, query, session }) {
  const filter = { merchantId };
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const limit = Math.min(query.limit ?? 20, 100);
  const operations = await ProviderOperation.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .session(session)
    .lean();

  return { operations, count: operations.length };
}

export { PROVIDER_OPERATION_TYPES, PROVIDER_OPERATION_STATUS };

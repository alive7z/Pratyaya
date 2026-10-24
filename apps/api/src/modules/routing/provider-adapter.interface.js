export class ProviderAdapterError extends Error {
  constructor(message, code, retryable = false, providerOperationId = null) {
    super(message);
    this.name = "ProviderAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.providerOperationId = providerOperationId;
  }
}

export const PROVIDER_RESULT_TYPES = Object.freeze({
  SUCCESS: "SUCCESS",
  DECLINED: "DECLINED",
  TEMPORARY_FAILURE: "TEMPORARY_FAILURE",
  UNKNOWN: "UNKNOWN",
  PERMANENT_ERROR: "PERMANENT_ERROR",
});

export const PROVIDER_OPERATION_OUTCOME = Object.freeze({
  CONFIRMED_SUCCESS: "CONFIRMED_SUCCESS",
  CONFIRMED_DECLINE: "CONFIRMED_DECLINE",
  NO_EVIDENCE_OF_EFFECT: "NO_EVIDENCE_OF_EFFECT",
  UNKNOWN_OUTCOME: "UNKNOWN_OUTCOME",
});

export class NormalizedProviderResult {
  constructor({
    providerId,
    operationId,
    providerReference,
    operationType,
    resultType,
    outcome,
    confirmedOutcome,
    failureClassification,
    retryEligible,
    processingLatencyMs,
    rawResponse,
    safeErrorInfo,
  }) {
    this.providerId = providerId;
    this.operationId = operationId;
    this.providerReference = providerReference;
    this.operationType = operationType;
    this.resultType = resultType;
    this.outcome = outcome;
    this.confirmedOutcome = confirmedOutcome;
    this.failureClassification = failureClassification;
    this.retryEligible = retryEligible;
    this.processingLatencyMs = processingLatencyMs;
    this.rawResponse = rawResponse;
    this.safeErrorInfo = safeErrorInfo;
  }

  static success({
    providerId,
    operationId,
    providerReference,
    operationType,
    processingLatencyMs,
    rawResponse,
  }) {
    return new NormalizedProviderResult({
      providerId,
      operationId,
      providerReference,
      operationType,
      resultType: PROVIDER_RESULT_TYPES.SUCCESS,
      outcome: PROVIDER_OPERATION_OUTCOME.CONFIRMED_SUCCESS,
      confirmedOutcome: true,
      failureClassification: null,
      retryEligible: false,
      processingLatencyMs,
      rawResponse,
      safeErrorInfo: null,
    });
  }

  static declined({
    providerId,
    operationId,
    providerReference,
    operationType,
    processingLatencyMs,
    rawResponse,
    reason,
  }) {
    return new NormalizedProviderResult({
      providerId,
      operationId,
      providerReference,
      operationType,
      resultType: PROVIDER_RESULT_TYPES.DECLINED,
      outcome: PROVIDER_OPERATION_OUTCOME.CONFIRMED_DECLINE,
      confirmedOutcome: true,
      failureClassification: { type: "DECLINE", reason },
      retryEligible: false,
      processingLatencyMs,
      rawResponse,
      safeErrorInfo: { reason },
    });
  }

  static temporaryFailure({
    providerId,
    operationId,
    operationType,
    processingLatencyMs,
    rawResponse,
    error,
    retryable = true,
  }) {
    return new NormalizedProviderResult({
      providerId,
      operationId,
      providerReference: null,
      operationType,
      resultType: PROVIDER_RESULT_TYPES.TEMPORARY_FAILURE,
      outcome: PROVIDER_OPERATION_OUTCOME.NO_EVIDENCE_OF_EFFECT,
      confirmedOutcome: false,
      failureClassification: {
        type: "TEMPORARY_FAILURE",
        reason: error?.message ?? "Unknown temporary failure",
      },
      retryEligible: retryable,
      processingLatencyMs,
      rawResponse,
      safeErrorInfo: { reason: error?.message ?? "Unknown temporary failure" },
    });
  }

  static unknown({
    providerId,
    operationId,
    operationType,
    processingLatencyMs,
    rawResponse,
    reason,
  }) {
    return new NormalizedProviderResult({
      providerId,
      operationId,
      providerReference: null,
      operationType,
      resultType: PROVIDER_RESULT_TYPES.UNKNOWN,
      outcome: PROVIDER_OPERATION_OUTCOME.UNKNOWN_OUTCOME,
      confirmedOutcome: false,
      failureClassification: { type: "UNKNOWN", reason },
      retryEligible: false,
      processingLatencyMs,
      rawResponse,
      safeErrorInfo: { reason },
    });
  }

  static permanentError({
    providerId,
    operationId,
    operationType,
    processingLatencyMs,
    rawResponse,
    error,
  }) {
    return new NormalizedProviderResult({
      providerId,
      operationId,
      providerReference: null,
      operationType,
      resultType: PROVIDER_RESULT_TYPES.PERMANENT_ERROR,
      outcome: PROVIDER_OPERATION_OUTCOME.NO_EVIDENCE_OF_EFFECT,
      confirmedOutcome: false,
      failureClassification: {
        type: "PERMANENT_ERROR",
        reason: error?.message ?? "Permanent error",
      },
      retryEligible: false,
      processingLatencyMs,
      rawResponse,
      safeErrorInfo: { reason: error?.message ?? "Permanent error" },
    });
  }
}

export class ProviderAdapter {
  constructor(_providerId, _config) {}

  async authorizePayment(_request) {
    throw new Error("authorizePayment not implemented");
  }

  async capturePayment(_request) {
    throw new Error("capturePayment not implemented");
  }

  async refundPayment(_request) {
    throw new Error("refundPayment not implemented");
  }

  async getOperationStatus(_operationId) {
    throw new Error("getOperationStatus not implemented");
  }

  async getHealthStatus() {
    throw new Error("getHealthStatus not implemented");
  }

  verifyWebhook(_payload, _signature, _timestamp) {
    throw new Error("verifyWebhook not implemented");
  }

  normalizeError(_error) {
    return {
      type: "PROVIDER_ERROR",
      message: "Provider error",
      code: "PROVIDER_ERROR",
      retryable: false,
    };
  }
}

export function createProviderAdapter(_providerId, _config) {
  throw new Error(
    "Provider adapter factory not implemented. Use specific adapter implementations.",
  );
}

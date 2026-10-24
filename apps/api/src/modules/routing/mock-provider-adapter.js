import { createHmac, timingSafeEqual } from "node:crypto";
import {
  NormalizedProviderResult,
  ProviderAdapter,
} from "./provider-adapter.interface.js";
import { PROVIDER_IDS } from "@pratyaya/shared";

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

function signPayload(bodyText, timestamp, secret) {
  const message = `${timestamp}.${bodyText}`;
  return createHmac("sha256", secret).update(message).digest("hex");
}

function buildHeaders(payload, idempotencyKey, secret) {
  const bodyText =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signPayload(bodyText, timestamp, secret);
  return {
    "Content-Type": "application/json",
    "X-Request-ID": crypto.randomUUID(),
    "X-Timestamp": timestamp,
    "X-Signature": signature,
    "Idempotency-Key": idempotencyKey,
  };
}

async function requestWithRetry({
  method,
  url,
  payload,
  headers,
  timeoutMs,
  retries,
}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error("Provider returned invalid JSON");
      }

      if (!response.ok) {
        const error = new Error(
          responseData.error?.message ?? "Provider request failed",
        );
        error.status = response.status;
        error.code = responseData.error?.code ?? "PROVIDER_ERROR";
        error.details = responseData.error?.details;
        if (
          response.status >= 500 &&
          response.status < 600 &&
          attempt < retries
        ) {
          lastError = error;
          await delay(
            BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 100,
          );
          continue;
        }
        throw error;
      }

      return {
        data: responseData.data,
        meta: responseData.meta,
        status: response.status,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.status) throw error;
      if (error.name === "AbortError") {
        lastError = new Error("Provider request timed out");
        lastError.code = "PROVIDER_TIMEOUT";
        lastError.status = 504;
      } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        lastError = new Error("Provider is unreachable");
        lastError.code = "PROVIDER_UNREACHABLE";
        lastError.status = 503;
      } else {
        lastError = error;
        lastError.code = lastError.code ?? "PROVIDER_NETWORK_ERROR";
        lastError.status = lastError.status ?? 502;
      }

      if (attempt < retries) {
        await delay(
          BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 100,
        );
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockProviderAdapter extends ProviderAdapter {
  constructor(providerId, config) {
    super(providerId, config);
    this.providerId = providerId;
    this.baseUrl = config.baseUrl;
    this.hmacSecret = config.hmacSecret;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.retryAttempts ?? MAX_RETRIES;
    this.providerFaults = config.faults ?? { enabled: false, rules: [] };
  }

  getFaultConfig() {
    if (!this.providerFaults?.enabled) return null;
    return this.providerFaults.rules?.find((f) => f.enabled === true) ?? null;
  }

  async applyFault(fault, _operation) {
    if (!fault) return null;

    switch (fault.type) {
      case "timeout": {
        const delayMs = fault.delayMs ?? 30000;
        await delay(delayMs);
        return { type: "timeout", message: "Simulated provider timeout" };
      }
      case "latency": {
        const delayMs = fault.delayMs ?? 2000;
        await delay(delayMs);
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
        const error = new Error(fault.message ?? "Simulated provider error");
        error.status = fault.statusCode ?? 500;
        error.code = fault.code ?? "PROVIDER_ERROR";
        throw error;
      }
      default:
        return null;
    }
  }

  async authorizePayment({
    clientOperationId,
    amountMinor,
    currency,
    paymentMethod,
    description,
    metadata,
    idempotencyKey,
    merchantId,
  }) {
    const startTime = Date.now();
    const payload = {
      clientOperationId,
      amountMinor,
      currency,
      idempotencyKey,
      merchantId,
      paymentMethod,
      description,
      metadata,
    };

    const fault = this.getFaultConfig();
    const faultResult = await this.applyFault(fault);

    if (faultResult?.type === "timeout") {
      return NormalizedProviderResult.unknown({
        providerId: this.providerId,
        operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
        operationType: "AUTHORIZE",
        processingLatencyMs: Date.now() - startTime,
        reason: "Provider timeout - outcome unknown",
      });
    }

    if (faultResult?.type === "decline") {
      return NormalizedProviderResult.declined({
        providerId: this.providerId,
        operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
        operationType: "AUTHORIZE",
        processingLatencyMs: Date.now() - startTime,
        reason: faultResult.message,
      });
    }

    try {
      const response = await requestWithRetry({
        method: "POST",
        url: `${this.baseUrl}/provider/v1/authorizations`,
        payload,
        headers: buildHeaders(payload, idempotencyKey, this.hmacSecret),
        timeoutMs: this.timeoutMs,
        retries: this.maxRetries,
        providerId: this.providerId,
      });

      const providerResponse = response.data;
      return NormalizedProviderResult.success({
        providerId: this.providerId,
        operationId: providerResponse.operationId,
        providerReference: providerResponse.providerReference,
        operationType: "AUTHORIZE",
        processingLatencyMs: Date.now() - startTime,
        rawResponse: providerResponse,
      });
    } catch (error) {
      if (error.code === "PROVIDER_TIMEOUT" || error.status === 504) {
        return NormalizedProviderResult.unknown({
          providerId: this.providerId,
          operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
          operationType: "AUTHORIZE",
          processingLatencyMs: Date.now() - startTime,
          reason: "Provider timeout - outcome unknown",
        });
      }
      return NormalizedProviderResult.permanentError({
        providerId: this.providerId,
        operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
        operationType: "AUTHORIZE",
        processingLatencyMs: Date.now() - startTime,
        error,
      });
    }
  }

  async capturePayment({
    clientOperationId,
    authorizationOperationId,
    amountMinor,
    currency,
    idempotencyKey,
    merchantId,
    metadata,
  }) {
    const startTime = Date.now();
    const payload = {
      clientOperationId,
      authorizationOperationId,
      amountMinor,
      currency,
      idempotencyKey,
      merchantId,
      metadata,
    };

    const fault = this.getFaultConfig();
    const faultResult = await this.applyFault(fault);

    if (faultResult?.type === "timeout") {
      return NormalizedProviderResult.unknown({
        providerId: this.providerId,
        operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
        operationType: "CAPTURE",
        processingLatencyMs: Date.now() - startTime,
        reason: "Provider timeout - outcome unknown",
      });
    }

    if (faultResult?.type === "decline") {
      return NormalizedProviderResult.declined({
        providerId: this.providerId,
        operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
        operationType: "CAPTURE",
        processingLatencyMs: Date.now() - startTime,
        reason: faultResult.message,
      });
    }

    try {
      const response = await requestWithRetry({
        method: "POST",
        url: `${this.baseUrl}/provider/v1/captures`,
        payload,
        headers: buildHeaders(payload, idempotencyKey, this.hmacSecret),
        timeoutMs: this.timeoutMs,
        retries: this.maxRetries,
        providerId: this.providerId,
      });

      const providerResponse = response.data;
      return NormalizedProviderResult.success({
        providerId: this.providerId,
        operationId: providerResponse.operationId,
        providerReference: providerResponse.providerReference,
        operationType: "CAPTURE",
        processingLatencyMs: Date.now() - startTime,
        rawResponse: providerResponse,
      });
    } catch (error) {
      if (error.code === "PROVIDER_TIMEOUT" || error.status === 504) {
        return NormalizedProviderResult.unknown({
          providerId: this.providerId,
          operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
          operationType: "CAPTURE",
          processingLatencyMs: Date.now() - startTime,
          reason: "Provider timeout - outcome unknown",
        });
      }
      return NormalizedProviderResult.permanentError({
        providerId: this.providerId,
        operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
        operationType: "CAPTURE",
        processingLatencyMs: Date.now() - startTime,
        error,
      });
    }
  }

  async refundPayment({
    clientOperationId,
    captureOperationId,
    amountMinor,
    currency,
    idempotencyKey,
    merchantId,
    reason,
    metadata,
  }) {
    const startTime = Date.now();
    const payload = {
      clientOperationId,
      captureOperationId,
      amountMinor,
      currency,
      idempotencyKey,
      merchantId,
      reason,
      metadata,
    };

    const fault = this.getFaultConfig();
    const faultResult = await this.applyFault(fault);

    if (faultResult?.type === "timeout") {
      return NormalizedProviderResult.unknown({
        providerId: this.providerId,
        operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
        operationType: "REFUND",
        processingLatencyMs: Date.now() - startTime,
        reason: "Provider timeout - outcome unknown",
      });
    }

    if (faultResult?.type === "decline") {
      return NormalizedProviderResult.declined({
        providerId: this.providerId,
        operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
        operationType: "REFUND",
        processingLatencyMs: Date.now() - startTime,
        reason: faultResult.message,
      });
    }

    try {
      const response = await requestWithRetry({
        method: "POST",
        url: `${this.baseUrl}/provider/v1/refunds`,
        payload,
        headers: buildHeaders(payload, idempotencyKey, this.hmacSecret),
        timeoutMs: this.timeoutMs,
        retries: this.maxRetries,
        providerId: this.providerId,
      });

      const providerResponse = response.data;
      return NormalizedProviderResult.success({
        providerId: this.providerId,
        operationId: providerResponse.operationId,
        providerReference: providerResponse.providerReference,
        operationType: "REFUND",
        processingLatencyMs: Date.now() - startTime,
        rawResponse: providerResponse,
      });
    } catch (error) {
      if (error.code === "PROVIDER_TIMEOUT" || error.status === 504) {
        return NormalizedProviderResult.unknown({
          providerId: this.providerId,
          operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
          operationType: "REFUND",
          processingLatencyMs: Date.now() - startTime,
          reason: "Provider timeout - outcome unknown",
        });
      }
      return NormalizedProviderResult.permanentError({
        providerId: this.providerId,
        operationId: `op_${crypto.randomUUID().slice(0, 24)}`,
        operationType: "REFUND",
        processingLatencyMs: Date.now() - startTime,
        error,
      });
    }
  }

  async getOperationStatus(operationId) {
    const response = await fetch(
      `${this.baseUrl}/provider/v1/operations/${operationId}`,
      {
        method: "GET",
        headers: buildHeaders("", `get-${operationId}`, this.hmacSecret),
      },
    );

    const responseText = await response.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error("Provider returned invalid JSON");
    }

    if (!response.ok) {
      throw new Error(
        responseData.error?.message ?? "Provider operation lookup failed",
      );
    }

    return responseData.data;
  }

  async getHealthStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/health/ready`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error("Provider returned invalid JSON");
      }

      return {
        healthy: response.ok && responseData.data?.status === "ready",
        latencyMs: responseData.data?.checks?.database?.latencyMs,
        checks: responseData.data?.checks,
      };
    } catch {
      return { healthy: false, latencyMs: null, checks: null };
    }
  }

  verifyWebhook(payload, signature, timestamp) {
    const message = `${timestamp}.${JSON.stringify(payload)}`;
    const expectedSignature = createHmac("sha256", this.hmacSecret)
      .update(message)
      .digest("hex");
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expectedBuffer);
  }

  normalizeError(error) {
    return {
      type: "PROVIDER_ERROR",
      message: error.message,
      code: error.code,
      retryable: error.status >= 500 || error.code === "PROVIDER_TIMEOUT",
    };
  }
}

export function createMockProviderAdapter(providerId, config) {
  if (!Object.values(PROVIDER_IDS).includes(providerId)) {
    throw new Error(`Unknown provider ID: ${providerId}`);
  }
  return new MockProviderAdapter(providerId, config);
}

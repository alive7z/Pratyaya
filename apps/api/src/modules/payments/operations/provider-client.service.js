import { createHmac } from "node:crypto";
import { randomUUID } from "node:crypto";
import { AppError } from "../../../lib/errors.js";

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

function createProviderClient({
  baseUrl,
  hmacSecret,
  _logger,
  fetchFn = fetch,
}) {
  function signPayload(bodyText, timestamp) {
    const message = `${timestamp}.${bodyText}`;
    return createHmac("sha256", hmacSecret).update(message).digest("hex");
  }

  function buildHeaders(bodyText, idempotencyKey) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(bodyText, timestamp);
    return {
      "Content-Type": "application/json",
      "X-Request-ID": randomUUID(),
      "X-Timestamp": timestamp,
      "X-Signature": signature,
      "Idempotency-Key": idempotencyKey,
    };
  }

  async function requestWithRetry({
    method,
    path,
    payload,
    idempotencyKey,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = MAX_RETRIES,
  }) {
    let lastError;
    const url = `${baseUrl}${path}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const bodyText = method === "GET" ? "" : JSON.stringify(payload);
        const response = await fetchFn(url, {
          method,
          headers: buildHeaders(bodyText, idempotencyKey),
          body: method === "GET" ? undefined : bodyText,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseText = await response.text();
        let responseData;
        try {
          responseData = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new AppError(
            502,
            "PROVIDER_INVALID_RESPONSE",
            "Provider returned invalid JSON",
          );
        }

        if (!response.ok) {
          const error = new AppError(
            response.status,
            responseData.error?.code ?? "PROVIDER_ERROR",
            responseData.error?.message ?? "Provider request failed",
            responseData.error?.details,
          );
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
        if (error instanceof AppError) throw error;
        if (error.name === "AbortError") {
          lastError = new AppError(
            504,
            "PROVIDER_TIMEOUT",
            "Provider request timed out",
          );
        } else if (
          error.code === "ECONNREFUSED" ||
          error.code === "ENOTFOUND"
        ) {
          lastError = new AppError(
            503,
            "PROVIDER_UNREACHABLE",
            "Provider is unreachable",
          );
        } else {
          lastError = new AppError(
            502,
            "PROVIDER_NETWORK_ERROR",
            "Network error calling provider",
          );
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

  async function authorize({
    clientOperationId,
    amountMinor,
    currency,
    paymentMethod,
    description,
    metadata,
    idempotencyKey,
    merchantId,
  }) {
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
    return requestWithRetry({
      method: "POST",
      path: "/provider/v1/authorizations",
      payload,
      idempotencyKey,
    });
  }

  async function capture({
    clientOperationId,
    authorizationOperationId,
    amountMinor,
    currency,
    idempotencyKey,
    merchantId,
    metadata,
  }) {
    const payload = {
      clientOperationId,
      authorizationOperationId,
      amountMinor,
      currency,
      idempotencyKey,
      merchantId,
      metadata,
    };
    return requestWithRetry({
      method: "POST",
      path: "/provider/v1/captures",
      payload,
      idempotencyKey,
    });
  }

  async function refund({
    clientOperationId,
    captureOperationId,
    amountMinor,
    currency,
    idempotencyKey,
    merchantId,
    reason,
    metadata,
  }) {
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
    return requestWithRetry({
      method: "POST",
      path: "/provider/v1/refunds",
      payload,
      idempotencyKey,
    });
  }

  async function getOperation({ operationId, idempotencyKey }) {
    return requestWithRetry({
      method: "GET",
      path: `/provider/v1/operations/${operationId}`,
      payload: {},
      idempotencyKey: idempotencyKey ?? `get-${operationId}`,
    });
  }

  return { authorize, capture, refund, getOperation };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createProviderClientService(config, logger) {
  const baseUrl = config.providerBaseUrl;
  const hmacSecret = config.mockProviderHmacSecret;

  if (!baseUrl || !hmacSecret) {
    throw new Error(
      "Provider client requires PROVIDER_BASE_URL and MOCK_PROVIDER_HMAC_SECRET",
    );
  }

  return createProviderClient({ baseUrl, hmacSecret, logger });
}

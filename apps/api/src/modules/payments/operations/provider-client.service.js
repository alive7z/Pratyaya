
import { createHmac, randomUUID } from "node:crypto";
import { AppError } from "../../../lib/errors.js";

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createProviderClient({
  baseUrl,
  hmacSecret,
  providerId = "alpha",
  logger,
  fetchFn = fetch,
  defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = MAX_RETRIES,
  baseRetryDelayMs = BASE_RETRY_DELAY_MS,
}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (!["http:", "https:"].includes(new URL(normalizedBaseUrl).protocol)) {
    throw new Error("Provider URL must use HTTP or HTTPS");
  }

  if (typeof hmacSecret !== "string" || hmacSecret.length < 32) {
    throw new Error("Provider HMAC secret must contain at least 32 characters");
  }

  function resolveUrl(path, requestedProviderId) {
    const selectedProvider = requestedProviderId ?? providerId;

    if (!["alpha", "beta", "gamma"].includes(selectedProvider)) {
      throw new AppError(
        400,
        "INVALID_PROVIDER",
        "Invalid provider identifier",
      );
    }

    const base = new URL(normalizedBaseUrl);
    const pathname = base.pathname.replace(/\/+$/, "");

    let prefix;

    if (/\/provider\/(alpha|beta|gamma)$/.test(pathname)) {
      prefix = pathname.replace(
        /\/provider\/(alpha|beta|gamma)$/,
        `/provider/${selectedProvider}`,
      );
    } else if (pathname.endsWith("/provider")) {
      prefix = `${pathname}/${selectedProvider}`;
    } else {
      prefix = `${pathname}/provider/${selectedProvider}`;
    }

    return new URL(`${prefix}${path}`, base.origin).toString();
  }

  function buildHeaders(bodyText, idempotencyKey, selectedProviderId) {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const signature = createHmac("sha256", hmacSecret)
      .update(timestamp)
      .update(".")
      .update(bodyText)
      .digest("hex");

    return {
      "Content-Type": "application/json",
      "X-Request-ID": randomUUID(),
      "X-Provider-ID": selectedProviderId,
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
    requestedProviderId,
    timeoutMs = defaultTimeoutMs,
    retries = maxRetries,
  }) {
    const selectedProviderId = requestedProviderId ?? providerId;
    const url = resolveUrl(path, selectedProviderId);
    const bodyText = method === "GET" ? "" : JSON.stringify(payload);

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      throw new AppError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "A valid idempotency key is required",
      );
    }

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchFn(url, {
          method,
          headers: buildHeaders(
            bodyText,
            idempotencyKey,
            selectedProviderId,
          ),
          body: method === "GET" ? undefined : bodyText,
          signal: controller.signal,
          redirect: "manual",
        });

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
            responseData?.error?.code ?? "PROVIDER_ERROR",
            responseData?.error?.message ?? "Provider request failed",
            responseData?.error?.details,
          );

          if (response.status >= 500 && attempt < retries) {
            lastError = error;
          } else {
            throw error;
          }
        } else {
          if (!responseData?.data || typeof responseData.data !== "object") {
            throw new AppError(
              502,
              "PROVIDER_INVALID_RESPONSE",
              "Provider response is missing operation data",
            );
          }

          return {
            data: responseData.data,
            meta: responseData.meta ?? {},
            status: response.status,
            timeout: response.status === 202,
          };
        }
      } catch (error) {
        if (error instanceof AppError) {
          if (error.statusCode < 500 || attempt >= retries) {
            throw error;
          }

          lastError = error;
        } else {
          const timedOut =
            controller.signal.aborted ||
            error?.name === "AbortError" ||
            error?.name === "TimeoutError";

          const networkCode = error?.cause?.code ?? error?.code;

          lastError = timedOut
            ? new AppError(
                504,
                "PROVIDER_TIMEOUT",
                "Provider request timed out",
              )
            : ["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH"].includes(networkCode)
              ? new AppError(
                  503,
                  "PROVIDER_UNREACHABLE",
                  "Provider is unreachable",
                )
              : new AppError(
                  502,
                  "PROVIDER_NETWORK_ERROR",
                  "Network error while contacting provider",
                );
        }

        logger?.warn?.(
          {
            event: "provider.request.retry",
            method,
            providerId: selectedProviderId,
            attempt: attempt + 1,
            code: lastError.code,
          },
          "Provider request attempt failed",
        );

        if (attempt >= retries) throw lastError;
      } finally {
        clearTimeout(timeoutId);
      }

      const backoff =
        baseRetryDelayMs * 2 ** attempt + Math.random() * 100;

      await delay(backoff);
    }

    throw lastError;
  }

  function authorize({
    clientOperationId,
    amountMinor,
    currency,
    paymentMethod,
    description,
    metadata,
    idempotencyKey,
    merchantId,
    providerId: requestedProviderId,
  }) {
    return requestWithRetry({
      method: "POST",
      path: "/v1/authorizations",
      payload: {
        clientOperationId,
        amountMinor,
        currency,
        idempotencyKey,
        merchantId,
        paymentMethod,
        description,
        metadata,
      },
      idempotencyKey,
      requestedProviderId,
    });
  }

  function capture({
    clientOperationId,
    authorizationOperationId,
    amountMinor,
    currency,
    idempotencyKey,
    merchantId,
    metadata,
    providerId: requestedProviderId,
  }) {
    return requestWithRetry({
      method: "POST",
      path: "/v1/captures",
      payload: {
        clientOperationId,
        authorizationOperationId,
        amountMinor,
        currency,
        idempotencyKey,
        merchantId,
        metadata,
      },
      idempotencyKey,
      requestedProviderId,
    });
  }

  function refund({
    clientOperationId,
    captureOperationId,
    amountMinor,
    currency,
    idempotencyKey,
    merchantId,
    reason,
    metadata,
    providerId: requestedProviderId,
  }) {
    return requestWithRetry({
      method: "POST",
      path: "/v1/refunds",
      payload: {
        clientOperationId,
        captureOperationId,
        amountMinor,
        currency,
        idempotencyKey,
        merchantId,
        reason,
        metadata,
      },
      idempotencyKey,
      requestedProviderId,
    });
  }

  function getOperation({
    operationId,
    idempotencyKey,
    providerId: requestedProviderId,
  }) {
    if (!operationId || typeof operationId !== "string") {
      throw new AppError(
        400,
        "OPERATION_ID_REQUIRED",
        "A valid operation ID is required",
      );
    }

    return requestWithRetry({
      method: "GET",
      path: `/v1/operations/${encodeURIComponent(operationId)}`,
      idempotencyKey: idempotencyKey ?? `get-${operationId}`,
      requestedProviderId,
    });
  }

  return {
    authorize,
    capture,
    refund,
    getOperation,
  };
}

export function createProviderClientService(config, logger) {
  const baseUrl = config?.providerBaseUrl;
  const hmacSecret = config?.mockProviderHmacSecret;

  if (!baseUrl || !hmacSecret) {
    throw new Error(
      "Provider client requires PROVIDER_BASE_URL and MOCK_PROVIDER_HMAC_SECRET",
    );
  }

  return createProviderClient({
    baseUrl,
    hmacSecret,
    providerId: config.providerId ?? "alpha",
    logger,
  });
}

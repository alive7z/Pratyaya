import { describe, expect, it, vi } from "vitest";
import { createProviderClient } from "../src/modules/payments/operations/provider-client.service.js";

const secret = "test-provider-hmac-secret-at-least-32-characters";

function client(fetchFn, options = {}) {
  return createProviderClient({
    baseUrl: "http://127.0.0.1:4100/provider/alpha",
    hmacSecret: secret,
    providerId: "alpha",
    fetchFn,
    defaultTimeoutMs: 10,
    maxRetries: 2,
    baseRetryDelayMs: 1,
    ...options,
  });
}

function authorize(providerClient) {
  return providerClient.authorize({
    clientOperationId: "auth-stable-operation-id",
    amountMinor: "1000",
    currency: "USD",
    paymentMethod: { type: "card", token: "tok_synthetic" },
    idempotencyKey: "stable-idempotency-key",
    merchantId: "merchant-test",
  });
}

describe("provider client reliability", () => {
  it("retries transient 5xx responses with the same operation identity", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "TEMPORARY", message: "retry" } }),
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "TEMPORARY", message: "retry" } }),
          { status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              operationId: "auth-stable-operation-id",
              status: "SUCCEEDED",
            },
          }),
          { status: 200 },
        ),
      );

    const result = await authorize(client(fetchFn));

    expect(result.data.status).toBe("SUCCEEDED");
    expect(fetchFn).toHaveBeenCalledTimes(3);
    const operationIds = fetchFn.mock.calls.map(
      ([, request]) => JSON.parse(request.body).clientOperationId,
    );
    expect(new Set(operationIds)).toEqual(
      new Set(["auth-stable-operation-id"]),
    );
  });

  it("reports timeout only after bounded retries", async () => {
    const fetchFn = vi.fn(
      (_url, request) =>
        new Promise((_resolve, reject) => {
          request.signal.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    await expect(
      authorize(client(fetchFn, { maxRetries: 1 })),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", statusCode: 504 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

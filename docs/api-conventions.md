# API conventions

The Express API is mounted at `/api/v1`. Its contract is documented in [OpenAPI](openapi.yaml) and served locally at `/api-docs`.

## Response and error envelopes

Successful handlers return a `data` object and request metadata:

```json
{
  "data": { "id": "..." },
  "meta": { "requestId": "...", "timestamp": "2026-10-25T00:00:00.000Z" }
}
```

Errors return a stable machine-readable code, a safe message, and request ID:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed"
  },
  "meta": { "requestId": "..." }
}
```

The API accepts a caller request ID only when it matches the configured safe pattern; otherwise middleware assigns one. Validation errors use `422`, malformed JSON `400`, missing authentication `401`, denied permissions `403`, state/idempotency conflicts `409`, rate limiting `429`, and unavailable dependencies `503`. Raw MongoDB, stack, provider-secret, and credential details are not returned to clients.

## Money and idempotency

- Financial request fields use decimal strings in minor units, such as `"50000"` for USD 500.00. Do not send a JSON number or a UI major-unit value to a minor-unit API field.
- The React payment/refund forms accept major units and convert once before sending the request.
- Payment creation and other supported mutations require an `Idempotency-Key` header. A retry with the same key and same canonical request returns the prior result; the same key with a different request is a conflict.
- Cookie-authenticated unsafe requests require `X-CSRF-Token` to match the readable CSRF cookie. Bearer clients use the documented bearer flow.

## Authentication and demo access

Login and registration set HttpOnly session cookies. Refresh and logout are CSRF-protected. `GET /api/v1/auth/me` returns the current user, membership, session, and permission list. The public, rate-limited `POST /api/v1/demo/session` creates a short-lived session for one of the allowlisted Explore-as roles.

Demo sessions can exercise synthetic write workflows according to their server-side role permissions. They are not read-only, but all operations use fictional sandbox data; fault injection is further restricted to demo sessions and disabled in production. UI visibility is not an authorization boundary—API middleware enforces permissions and merchant scope.

## Main endpoint groups

| Prefix              | Representative routes                                                                  | Access boundary                                                         |
| ------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `/health`           | `GET /live`, `GET /ready`                                                              | Public liveness/readiness                                               |
| `/auth`             | `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`            | Public login/register; authenticated identity; CSRF on cookie mutations |
| `/demo`             | `GET /roles`, `POST /session`                                                          | Public allowlisted role discovery/session creation with rate limits     |
| `/payments`         | `GET/POST /`, `GET /:id`, `GET /:id/timeline`, `POST /:id/capture`, `POST /:id/cancel` | Merchant-scoped auth and payment permissions                            |
| `/payments` refunds | `POST /:id/refunds`, `GET /:id/refunds`, `POST /refunds/:refundId/process`             | Payment permissions, idempotency, CSRF for mutations                    |
| `/ledger`           | Accounts, journals, balances, trial balance, integrity reports/check                   | `ledger.read`; separate `ledger.integrity.run` for a check              |
| `/reconciliation`   | Records, cases, summaries, `POST /:paymentId/check`                                    | Merchant-scoped `reconciliation.read`                                   |
| `/webhooks`         | `POST /provider`, `GET /inbox`, retry failed inbox event                               | Signed provider callback; authenticated scoped inbox/retry access       |
| `/routing`, `/risk` | Policies, decisions, health, alerts, rules                                             | Role permissions and input validation                                   |
| `/agentpay`         | Policies, invoice proposals, decision, execution                                       | Payment permissions plus policy/approval checks                         |
| `/sandbox`          | Jobs, outbox, provider operations, demo fault settings                                 | Scoped permissions; fault controls are demo-only                        |

Paths in the table are relative to `/api/v1`. See [payment state transitions](payment-state-machine.md), [financial invariants](financial-invariants.md), and the [API source route mounts](../apps/api/src/app.js) before relying on endpoint semantics.

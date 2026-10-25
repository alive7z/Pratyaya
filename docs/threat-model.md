# Threat model and security controls

Pratyaya is a synthetic payment reliability lab. It accepts no real payment credentials and must not be used to move real money. The threat model covers browser input, cookies/headers, demo sessions, API clients, worker payloads, provider responses, and database access.

## Trust boundaries

- Browser and API request data are untrusted.
- The core MongoDB database is authoritative for payment and ledger state.
- The mock provider uses a separately configured database and authenticated operation interface.
- Outbox/job payloads and provider responses are validated before state transitions.
- Frontend state and analytics are display projections, never financial truth.

## Implemented controls

- Environment validation; connection strings and secrets are excluded from system-info responses and structured logs are configured for redaction.
- Helmet, bounded request bodies, restricted CORS, rate limits, request IDs, and centralized error handling.
- Mongoose buffering disabled and database connection timeouts bounded.
- Short-lived access JWTs in HttpOnly cookies; refresh tokens are rotated and stored hashed.
- CSRF double-submit checks on cookie-authenticated refresh/logout mutations.
- Server-side RBAC and merchant membership checks at protected route/service boundaries.
- Demo sessions are credential-free, short-lived, rate-limited, revocable, and restricted to synthetic sandbox data; write capabilities are limited by role and route permissions.
- Provider operation requests use signed authentication, schema validation, provider scoping, and persistent idempotency/operation identities.
- Payment/refund idempotency and conditional state transitions are backed by MongoDB unique indexes and transactions.
- Ledger journals are append-only through supported model operations; audit events capture privileged actions.

## Remaining risks and limits

- Hosted deployment controls (TLS termination, origin allowlists, secret provisioning, network rules, and service scaling) must be verified in the target accounts; repository configuration alone does not prove runtime posture.
- In-memory rate limiting may not coordinate across multiple API replicas; use shared storage before horizontal scaling.
- Provider HTTP waits currently occur inside some orchestration transaction callbacks. Split external dispatch and transactional outcome application before production hardening.
- Direct privileged database writes can bypass application immutability hooks; restrict database roles and run integrity checks.
- No PCI compliance, real-money authorization, or production payment-provider integration is claimed.

See [deployment](deployment.md), [financial invariants](architecture/financial-invariants.md), and [testing](testing.md) for operational controls and verification boundaries.

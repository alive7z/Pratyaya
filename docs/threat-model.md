# Threat model

## Trust boundaries

Browser input, headers, cookies, future webhook bodies, queue/outbox payloads, provider responses, and invoice text are untrusted. MongoDB Atlas is authoritative. The provider database is a separate trust boundary. Frontend state is never financial truth.

## Implemented controls

- environment validation without logging connection strings
- Helmet, restricted CORS, body limits, rate limiting, safe request IDs, and centralized errors
- structured logger redaction for common credential fields
- Mongoose buffering disabled and connection timeouts bounded
- separate Atlas provider database with separately scoped credentials
- short-lived JWT access tokens in HttpOnly cookies and rotated, hashed refresh tokens in MongoDB
- CSRF double-submit validation for cookie-authenticated refresh/logout mutations
- server-side RBAC and merchant membership checks for dashboards and audit access
- credential-free, revocable, short-lived, rate-limited demo sessions restricted to synthetic sandbox data
- audit records for authentication, demo-session, and privileged dashboard events
- simulation-only warnings and no payment credential fields
- `/system/info` returns no URI, token, password, or host information

## Required in later milestones

- merchant predicates enforced in every repository once payment/ledger endpoints exist
- unique-index and transaction-based idempotency for financial operations
- HMAC webhook verification over raw bytes with replay protection
- immutable audit and ledger write paths
- database credentials scoped separately for core and provider Atlas deployments (configured through environment only)
- production distributed rate-limit storage if multiple API instances are deployed

Authentication and demo access are implemented at the API boundary, but payment, ledger, webhook, and reconciliation controls remain future work. Nothing in this project should be described as PCI compliance or authorization to process real money.

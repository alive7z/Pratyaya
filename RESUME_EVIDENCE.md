# Verified engineering evidence

Evidence date: 2026-10-24. This file contains only facts supported by the repository and commands run against the current workspace. It does not claim a public deployment.

## Implemented technologies

- JavaScript ES modules on Node.js 24; npm workspaces
- React, Vite, Tailwind CSS, TanStack Query, React Router
- Express, Zod, Mongoose, MongoDB Atlas
- Vitest, Supertest, jsdom, ESLint, Prettier
- Docker Compose, GitHub Actions, OpenAPI, Vercel config, Render Blueprint

## Verified implementation facts

- Four independently runnable processes/workspaces: React web, Express API, MongoDB-backed worker, and mock provider.
- Merchant-scoped authentication/RBAC and four credential-free synthetic demo roles.
- Minor-unit decimal-string API contracts, `BigInt` arithmetic, and balanced double-entry journal validation.
- Multi-document MongoDB transactions for local financial effects and an outbox written with domain state.
- Deterministic MongoDB jobs, atomic conditional leases, bounded retry/backoff, stale recovery, and dead-letter state.
- A stable provider operation ID is stored before HMAC-authenticated dispatch; timeout outcomes remain uncertain and are reconciled against that identity.
- Provider idempotency is constrained by provider, operation type, and key; webhook inbox events have deduplication constraints.
- AgentPay separates proposal drafting from authenticated human approval and server-side policy enforcement.
- Production configuration rejects short development JWT/provider secrets and enables secure cookies; secrets remain server-side.

## Command evidence

Final command counts are updated only after the complete verification run. The last completed Atlas provider integration run passed 14/14 tests in 5.36 seconds. The last completed API Atlas integration run before the final documentation pass passed 42/42 tests in 48.61 seconds. These durations describe test runs, not API latency.

No service throughput, percentile latency, uptime, or production traffic figure has been measured. No screenshot set or browser E2E suite is present. No deployed URL has been verified.

## Truthful resume bullets

- Built a JavaScript payment-reliability simulator with an Express modular monolith, React/Vite operations UI, MongoDB Atlas transactions, and separate persistent worker/provider runtimes.
- Implemented merchant-scoped idempotency, durable outbox/job leasing, stable provider operation identities, reconciliation, and balanced double-entry journals for synthetic capture/refund workflows.
- Added RBAC demo roles, HMAC provider authentication, human-approved AgentPay policies, automated Vitest/Supertest coverage, Docker/CI, and deployment-ready Vercel/Render configuration.

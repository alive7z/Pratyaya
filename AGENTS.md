# Pratyaya — coding-assistant instructions

Read `PAYCORE_ARCHITECTURE.md` before starting a major feature. Pratyaya is a synthetic payment reliability simulator, never a real payment processor.

## Non-negotiable architecture

- Use JavaScript ES modules for React/Vite and Node/Express. Do not switch to TypeScript, Next.js, SQL databases, or unnecessary microservices.
- Use a modular-monolith API with a separate worker and separate mock provider.
- MongoDB is authoritative. Use Mongoose for application persistence and multi-document transactions for atomic financial effects.
- Local transaction tests require a replica set. MongoDB Atlas is supported through environment-only connection strings.
- Durable jobs begin MongoDB-backed. Do not add Redis unless measured requirements later justify it and an ADR approves it.
- Business rules belong in domain services, HTTP controllers remain thin, persistence is isolated in models/repositories, and shared Zod schemas define request/event contracts.
- Store money as integer minor units using MongoDB `Long`/safe string conversions. JSON uses decimal strings. Never use floating-point money arithmetic.
- Enforce merchant isolation, RBAC, authorization, validation, and conditional concurrency checks on the server.
- Idempotency is unique per merchant and operation and includes a canonical payload fingerprint. Resolve concurrent first writers with unique indexes and transactions.
- Persist a provider operation ID before an outbound call. A timeout is `UNKNOWN`, not failure; reconciliation reuses the same operation ID.
- Queues and webhooks may duplicate delivery. Make business effects idempotent; never claim global exactly-once processing.
- Ledger journals are append-only, paired debit/credit entries, currency-balanced, and committed atomically with local state changes. Corrections create compensating journals.
- Use a transactional outbox in the same MongoDB transaction as domain changes. Workers lease outbox documents with conditional atomic updates.
- AI may draft proposals but cannot charge. Execution requires separately authenticated human approval and server-side policy enforcement.
- Chaos features are sandbox/admin-only and inaccessible in public production. Never accept real PAN, CVV, bank credentials, or personal payment data.

## Workflow

1. Inspect architecture and existing code before changes.
2. Work on one documented milestone at a time and do not implement later behavior as placeholders.
3. Check official documentation and workspace compatibility before adding dependencies.
4. Include failure behavior, validation, tests, and accurate documentation with every feature.
5. Never fabricate metrics, test results, completed features, or benchmark evidence.
6. Maintain `README.md`, `.env.example`, OpenAPI, architecture decisions, and `docs/PROGRESS.md`.
7. Keep the UI professional, accessible, responsive, white/blue by default, with an optional neutral dark mode and restrained animation.
8. Keep secrets out of Git, logs, frontend bundles, screenshots, and system-information endpoints.
9. Run supported verification commands and report failures honestly.
10. Resolve milestone blockers before dependent work begins.

## Commands

Keep `npm run dev`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run db:check`, and `docker compose up --build` reproducible. Never report a command as passing unless it was run successfully.

# Milestone roadmap

- **M01 Foundation:** Mongoose lifecycle, health/system API, process foundations, React shell, tests, docs, CI.
- **M02 Atlas, auth, and core correctness:** MongoDB Atlas-only persistence, auth/session cookies, CSRF, RBAC, demo sessions, role dashboards, audit logs, payment create/read, state machine, idempotency.
- **M03 Payment API foundation:** idempotent create/cancel, payment events, versioned transitions, outbox foundation, concurrency tests.
- **M04 Ledger engine:** immutable balanced journals, capture/refund fixtures, integrity guardian, merchant-scoped ledger APIs, Ledger Explorer, synthetic reconciliation diagnostics.
- **M05 Provider workflow and recovery:** provider simulator operations, outbox leasing/dispatch, authorize/capture/refund, signed webhooks, UNKNOWN resolution, durable recovery, live reconciliation.
- **M06 Product frontend:** payment, audit, reconciliation, and reliability workflows beyond the current dashboards and ledger explorer.
- **M07 AgentPay:** proposal parsing, policies, human approval, execution revalidation, adversarial tests.
- **M08 Observability and deployment:** tracing, metrics, dashboards, Vercel/Node hosting, smoke tests, honest benchmarks.

Only one milestone is implemented at a time. A later milestone cannot begin while prerequisite verification fails.

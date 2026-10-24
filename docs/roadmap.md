# Milestone roadmap

M01–M11 produced the current foundation, identity/RBAC, payments, ledger, provider simulation, durable work, reconciliation, routing/risk, AgentPay, and React operations interface. Historical implementation notes remain in Git history; current truth is the source, tests, and `docs/PROGRESS.md`.

## M12 — deployment and portfolio readiness

Implemented in the repository:

- Vercel SPA/proxy configuration
- Render API, provider, and persistent-worker Blueprint
- production environment validation and secret-only configuration points
- provider index migration
- deployment config checks and four-role hosted smoke script
- deployment/cost/limitation documentation
- recruiter README and evidence-only resume document

External completion gates:

- provision distinct least-privilege Atlas databases/users
- link Vercel and Render accounts and configure secrets
- deploy all services, record immutable working HTTPS URLs, and run hosted smoke tests
- perform a human browser/accessibility review and capture truthful screenshots
- split provider network waits from MongoDB transaction callbacks before describing the system as production-hardened

No later milestone is authorized by this document.

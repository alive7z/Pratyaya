# Roadmap and milestone status

The repository currently includes the M01–M11 product foundation: workspace/process setup, MongoDB persistence, demo identity and RBAC, payments, ledger and integrity, mock-provider operations, durable background work, reconciliation, risk/routing, AgentPay simulation, and React operations views. See [implementation progress](PROGRESS.md) for what was actually verified.

## M12 — deployment and portfolio readiness

### Present in the repository

- Vercel SPA and same-origin API proxy configuration.
- Render service definitions for API, mock provider, and persistent worker.
- Environment validation, production cookie/proxy settings, CORS, and secret configuration points.
- Provider index migration, deployment configuration check, and hosted smoke script.
- Deployment guidance, architecture diagrams, and recruiter-facing README.

### External gates still open

- Provision isolated, least-privilege Atlas databases/users and network access.
- Configure deployment secrets in Vercel and Render without committing them.
- Deploy services, record their actual HTTPS URLs, and run the hosted smoke test.
- Review the live UI for accessibility and capture screenshots from the running app.
- Move provider network waits out of transaction callbacks before claiming production hardening.

A deployment config file is not evidence of a deployed service. No hosted completion is claimed until each external gate is verified. Further feature work should wait for the user's next milestone request.

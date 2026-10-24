# Testing and verification

Run from the repository root with Node.js 24/npm 11:

```bash
npm run format:check
npm run lint
npm test
npm run build
npm run deploy:check
```

`npm test` runs API, mock-provider, React/jsdom, and shared-package suites. Integration files are deliberately skipped unless `RUN_INTEGRATION_TESTS=1` is set.

The following require untracked Atlas credentials and synthetic test databases that support transactions:

```bash
npm run db:check
npm run db:migrate:provider
npm run test:integration
```

The provider migration removes only the known obsolete `providerOperationId_1` index after verifying its exact key, then creates current schema indexes. Do not point tests or migrations at customer/real-money data.

After deployment:

```bash
PRATYAYA_WEB_URL=https://... \
PRATYAYA_API_URL=https://... \
PRATYAYA_PROVIDER_URL=https://... \
npm run smoke:deployment
```

The hosted smoke verifies frontend delivery, API liveness/readiness, available roles, four role sessions, identity, role dashboards, CSRF logout, and optional provider/worker readiness. A passing local run is not evidence of a successful hosted deployment.

Verified counts and dates belong in `RESUME_EVIDENCE.md` and `docs/PROGRESS.md`; performance claims require a separate reproducible benchmark.

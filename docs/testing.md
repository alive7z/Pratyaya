# Testing and verification

Run commands from the repository root. The project targets Node.js 24+ and npm 11+.

## Local checks

```bash
npm run format:check
npm run lint
npm test
npm run build
npm run deploy:check
```

`npm test` runs the API, mock-provider, React/jsdom, worker, and shared-package suites. Database-backed integration cases are skipped unless explicitly enabled; skipped cases are not passing integration evidence.

## Atlas-backed checks

These commands require separately configured, synthetic MongoDB databases on a replica set that supports transactions. Use credentials from an ignored local `.env` or CI secrets; never put a URI in a committed file or terminal transcript.

```bash
npm run db:check
npm run db:migrate:provider
npm run test:integration
```

The provider migration checks the exact obsolete index definition before removing it and then provisions the current provider indexes. Do not point test or migration commands at customer or real-money data.

## Hosted smoke test

```bash
PRATYAYA_WEB_URL=https://... \
PRATYAYA_API_URL=https://... \
PRATYAYA_PROVIDER_URL=https://... \
npm run smoke:deployment
```

The smoke script checks reachable frontend/API/provider endpoints and exercises the configured role-session flow. A local deployment configuration check does not prove that hosted services are deployed or reachable. Record URLs and results only after running this command against the actual deployment.

## Evidence policy

See [progress and verification status](PROGRESS.md) for the dated verification record. Test counts must be copied from actual command output; skipped tests must remain reported as skipped. Performance claims require a reproducible benchmark with environment, workload, and measurement method.

# Pokopia Companion Iteration 4.5 review package

This archive is a dependency-free, secret-free source review package. It contains application code,
the exact npm lockfile, append-only migrations, tests, documentation, machine-readable audit data
and the compact canonical review SQLite.

## Restore

Requirements: Node.js 22+, npm, Chromium installed by Playwright for E2E, and PostgreSQL 15+ local
binaries (`psql`, `initdb`, `pg_ctl`) for the disposable database gate.

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run security:test
npm run evidence:verify
npm run test:postgres --workspace @pokopia/db
npm run build
npm run test:e2e
npm audit --omit=dev
```

No private `.env` is required for these review gates. `.env.example` is a template only. Production
configuration intentionally fails closed until individual admin identity, a PostgreSQL rate-limit
backend, trusted proxy behavior, database credentials and operational controls are configured.

## Honest boundary

No hosted Supabase/Vercel project, DNS, production database or paid service was modified. The local
verdict is `CONDITIONAL GO`, not approval for immediate public launch. Read
`docs/PRODUCTION_READINESS.md`, `docs/ITERATION_4_5_REPORT.md` and
`audit-data/iteration-4-5/findings.json` before deployment work.

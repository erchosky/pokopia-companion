# Pokopia Companion Iteration 4.6 review package

Dependency-free, secret-free source package. It includes code, exact lockfile, migrations, tests,
documentation, machine audit evidence, preservation manifests and the compact REVIEW SQLite. It
does not contain `node_modules`, builds, caches, provider tokens, private environment files, previous
ZIPs, RAW HTML, the mirror/assets or the 1.04 GB master archive.

## Restore

Requirements: Node.js 22+, npm, Chromium for Playwright and local PostgreSQL 15+ binaries for the
disposable database gate.

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run security:test
npm run audit:review-data
npm run evidence:verify
npm run test:postgres --workspace @pokopia/db
npm run build
npm run test:e2e
npm audit --omit=dev
```

`npm run audit:review-data` verifies the compact audit when the excluded full canonical database is
absent. `npm run data:verify-master` additionally requires the private master corpus mounted at the
manifested path and is not a standalone REVIEW gate.

## Decision boundary

The package proves local code, schema, compact data and master-manifest references. Hosted assurance
is BLOCKED because Supabase requires reauthentication and the available Vercel team has no project.
Nothing in this archive authorizes production deployment. Read `docs/ITERATION_4_6_REPORT.md` and
`docs/PRODUCTION_READINESS.md`; the verdict is **CONDITIONAL GO**.

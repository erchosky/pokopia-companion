# Pokopia Companion — Iteration 4 review package

This is a clean, dependency-free project archive. It contains source code, the exact npm lockfile,
tests, migrations, documentation, audit evidence and a compact review SQLite database. It does not
contain `node_modules`, builds, caches, secrets, previous ZIP files or the full 2,532-page corpus.

## Restore

Requirements: Node.js 22 and npm.

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The applications automatically fall back to `audit-data/pokopia-review.sqlite`. That compact
database is real source-derived data, not a synthetic mock. It includes all Iteration 4 domains and
a deterministic representative subset of previous domains.

To use the full local canonical dataset instead, set:

```bash
export POKOPIA_DATABASE_PATH=/absolute/path/to/pokopia-canonical.sqlite
```

## What is intentionally absent

- Private `.env` files and credentials.
- `node_modules`, `.next`, `.turbo`, Playwright output and logs.
- Git metadata, symlinks and previous archives.
- The full canonical/source corpus. Its integrity and counts were validated before packaging; the
  compact database keeps the review package below the requested size target.

See `docs/ITERATION_4_REPORT.md`, `docs/ITERATION_4_AUDIT.md` and
`ARCHIVE_REPORT_ITERATION_4.md` for evidence, limits and verification results.

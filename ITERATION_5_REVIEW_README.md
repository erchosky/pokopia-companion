# Pokopia Companion — Iteration 5 review archive

This is a clean, dependency-free, restorable review archive. It contains source, exact lockfile,
tests, migrations, docs, audit artifacts and the compact review SQLite. It intentionally excludes
private source corpus bytes, secrets, dependencies, builds, caches, logs, VCS metadata and older
archives.

## Restore

Requires Node.js 22+ and npm 10.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The app resolves `audit-data/pokopia-review.sqlite` when the private canonical database is absent.
For master-corpus validation, restore the immutable source backup separately as described in
`docs/MASTER_DATA_ARCHIVE.md`.

## Important evidence boundary

Iteration 5 provides structural game logic. All 882 recipe output batch sizes and automation
throughput remain unknown until reviewed evidence/measurements exist. The engine does not replace
unknown values with one, zero or false.

See `docs/ITERATION_5_REPORT.md`, `docs/GAME_LOGIC_COVERAGE.md` and
`audit-data/iteration-5/summary.json`.

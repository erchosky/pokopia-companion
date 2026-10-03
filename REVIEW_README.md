# Pokopia Companion Iteration 3 review package

This is a compact, self-contained technical review of the exact Iteration 3 codebase. It contains source, workspace configuration, migrations, tests, documentation, UX screenshots, compact real audit data, and recorded validation/security results.

It intentionally does **not** contain the 1.8 GB source snapshot, the complete 70 MB canonical SQLite, dependencies, builds, caches, private environment files, Git internals, or previous archives.

## Restore and validate

Requires Node.js 22 and npm 10:

```bash
npm ci
npm run typecheck
npm test
POKOPIA_DATABASE_PATH="$PWD/audit-data/pokopia-review.sqlite" npm run build -- --env-mode=loose
```

The compact SQLite is a real subset of canonical v3.1, not a mock. Its integrity, selection, row counts, and source database SHA-256 are recorded in `audit-data/review-database-manifest.json` and `audit-data/database-metadata.json`.

## Review map

- `apps/`, `packages/`, `scripts/`, `supabase/`, `tests/`: implementation and validation source.
- `docs/`: architecture, data model, Iteration 3 reports, security and UX evidence.
- `audit-data/`: schema, database inventory, real samples, Knowledge Graph, search/scoring/optimizer runs, and six reference cases.
- `audit-results/`: reproducible commands, dependency versions, security scan, test/build/migration evidence, and restore results.

## Important data boundary

The complete source/canonical gates were executed before packaging and are recorded in `audit-results/results.json`. They cannot be rerun from this review package because the full snapshot is deliberately excluded. The included sample database is sufficient for code inspection and a production build, but it is not a replacement distribution of the complete game corpus.

# Pokopia Companion — Iteration 3.5 REVIEW

This is the clean, restorable review package for **Iteration 3.5 — Intelligence & Canonical Hardening**. It contains the complete application source, exact lockfile, migrations, tests, documentation and machine-readable audit evidence. It deliberately contains no installed dependencies, build output, private environment files or previous archives.

## Restore

Requires Node.js 22 and npm 10:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
POKOPIA_DATABASE_PATH="$PWD/audit-data/pokopia-review.sqlite" npm run build -- --env-mode=loose
```

The included `audit-data/pokopia-review.sqlite` is a real canonical subset, not a mock. Its origin, selection and integrity are recorded in `audit-data/review-database-manifest.json`.

## What to review

- `apps/`, `packages/`, `scripts/`, `supabase/`, `tests/`: implementation and test source.
- `docs/ITERATION_3_5_REPORT.md`: scope, verified changes and honest limits.
- `docs/DATABASE_PARITY.md`: SQLite/PostgreSQL parity contract.
- `docs/GOAL_ENGINE_V2.md`, `docs/SEARCH_V3_5.md`, `docs/TOWN_OPTIMIZER_V2_1.md`: behavior contracts.
- `audit-data/iteration-3.5/`: reproducible search, scoring, goal, optimizer, graph, provenance and PostgreSQL parity cases.
- `audit-results/`: command list, dependency inventory, security scan and full-workspace results.

## Deliberate data boundary

The complete 2,532-page source mirror and full canonical database are excluded to keep this REVIEW archive below 10 MB. Full-data validation, source-hash verification and disposable PostgreSQL verification were run before packaging and are recorded in `audit-results/results.json`.

The import does not promote candidate assertions to verified gameplay facts. No Supabase production project was contacted or modified.

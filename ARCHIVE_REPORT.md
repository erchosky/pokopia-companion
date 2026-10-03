# Clean archive report — Pokopia Companion Iteration 3

Archive: `Pokopia-Companion-Iteration-3-clean.zip`  
Created: 2026-08-09, Europe/Madrid  
Runtime: Node.js 22+, npm 10

## Included

Source code, exact `package-lock.json`, workspace manifests, migrations, tests, docs, screenshots, canonical SQLite/JSONL, processed pages, source snapshot, audit outputs, environment template and CI configuration.

## Excluded

`node_modules`, `.next`, `.turbo`, `.git`, Playwright/test results, logs, `.DS_Store`, private `.env*`, nested archives, caches and symlinks. `.env.example` is intentionally included and contains no values.

## Restore

```bash
unzip Pokopia-Companion-Iteration-3-clean.zip
cd Pokopia-Companion-Iteration-3
npm ci
npm run data:validate
npm run typecheck
npm test
npm run build
npm run test:e2e
```

No private environment file is required for the local SQLite-backed web product. Admin login or hosted Supabase validation requires target-specific configuration that is deliberately not bundled.

## Verified before packaging

- format, ESLint and TypeScript: PASS;
- 49 unit/integration tests: PASS;
- web + admin production builds: PASS;
- 22 Playwright runs across desktop Chromium and Pixel 7: PASS;
- 2.532-page data validation and source hash: PASS;
- SQLite integrity/FK and PostgreSQL migration invariants: PASS.

## Archive verification

The ZIP is tested with `unzip -t`, checked for required paths and prohibited dependencies/secrets, restored to a fresh temporary directory, then validated with `npm ci`, typecheck and build. The final ZIP SHA-256 is stored in the adjacent `.sha256` sidecar and reported at delivery time; embedding a ZIP's own digest inside itself is not possible.

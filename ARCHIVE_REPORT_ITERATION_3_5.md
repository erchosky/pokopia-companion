# Pokopia Companion Iteration 3.5 — REVIEW archive report

Generated: 2026-08-09 23:40 Europe/Madrid

## Final artifact

- Archive: `Pokopia-Companion-Iteration-3.5-REVIEW.zip`
- SHA-256: `6a590091cc7d7645e5cde514716c1b0d8cae3aadf109fa60aefdf0acf79f638e`
- Compressed size: 3,678,845 bytes (3.51 MiB)
- Uncompressed staging size: 12,276 KiB
- Files: 254
- ZIP entries including directories: 337
- Symbolic links: 0

The checksum is also stored in `Pokopia-Companion-Iteration-3.5-REVIEW.zip.sha256`. This report is adjacent to the archive because embedding the archive's own checksum would change that checksum.

## Included

- Complete application and package source under `apps/` and `packages/`.
- Workspace configuration, exact `package-lock.json`, `.env.example`, CI workflow and browser configuration.
- PostgreSQL migrations, seed/importer source, SQLite/PostgreSQL repository adapters and tests.
- Documentation for architecture, security, parity, Knowledge Graph, Goal Engine V2, Search V3.5, Scoring and Town Optimizer V2.1.
- Machine-readable Iteration 3.5 audit cases and security/results manifests.
- A 4.7 MiB real compact canonical SQLite subset for review, tests, builds and representative E2E flows.
- Source/canonical manifests and the ingestion audit, without the mass source corpus.

## Excluded intentionally

- `node_modules`, `.next`, `.turbo`, coverage, browser output, caches, logs and TypeScript build-info.
- `.git`, OS metadata and symbolic links.
- Real `.env` files, credentials, API keys, tokens and cookies.
- Previous ZIPs, source ZIPs and nested archives.
- Full source mirror and complete canonical JSONL/SQLite outputs, which would exceed the requested review-package limit.

## Full-workspace validation

- Format and ESLint with zero warnings: pass.
- Typecheck: 13/13 workspaces.
- Unit/workspace integration: 62 tests; 17/17 tasks.
- Playwright: 30/30 on desktop Chromium and Pixel 7.
- Production build: 7/7 tasks; web and admin pass.
- Canonical data: 2,532 pages, 12,183 tables and 3,308 RAG chunks.
- Full canonical SQLite: `integrity_check=ok`; zero foreign-key violations.
- PostgreSQL: migrations, constraints, two idempotent seeds and canonical parity pass in a disposable local PostgreSQL instance.
- Source SHA-256: verified.
- Production dependency audit: 0 vulnerabilities.
- Credential scan: 191 files; zero signatures and zero non-empty secret assignments outside `.env.example`.

## Clean restore validation

The exact final ZIP passed `unzip -tq`, unsafe-path checks, required/prohibited-content checks, symlink checks, nested-archive checks and the 10 MiB limit. It was then extracted into a fresh temporary directory:

- `npm ci`: pass; 479 packages installed from the lockfile.
- `npm run typecheck`: pass; 13/13 with zero cache hits.
- `npm test`: pass; 62 tests and 17/17 tasks with zero cache hits.
- `POKOPIA_DATABASE_PATH="$PWD/audit-data/pokopia-review.sqlite" npm run build -- --env-mode=loose`: pass; 7/7 tasks with zero cache hits.

The candidate archive with identical source/data and only the pre-final restore-evidence JSON pending also passed all 30/30 E2E flows from a fresh extraction using the compact review database.

## Honest boundary

Full-corpus ingestion validation and the 365/1,700/882/7/11 SQLite/PostgreSQL seed parity gate cannot be repeated from the compact REVIEW ZIP by design. Their successful pre-package evidence is retained in `audit-results/results.json` and `audit-data/iteration-3.5/postgres-parity.json`. No hosted Supabase project was contacted or changed.

No critical product blocker requiring `docs/PRE_ITERATION_4_BLOCKERS.md` was found.

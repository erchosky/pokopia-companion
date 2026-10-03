# Pokopia Companion Iteration 3 — REVIEW archive report

Generated: 2026-08-09 22:27 Europe/Madrid

## Final artifact

- Archive: `Pokopia-Companion-Iteration-3-REVIEW.zip`
- SHA-256: `a10db549d4e7ce78cf046b9aaf3851c5ec9930320da2d9a56866fe04c5573654`
- Compressed size: 3,548,935 bytes (3.4 MiB)
- Uncompressed file bytes: 10,471,396 bytes (10.0 MiB)
- Files: 227
- ZIP entries including directories: 299
- Symbolic links: 0

This finalized report is adjacent to the ZIP rather than embedded in it, because embedding a file containing the archive's own SHA-256 would change that SHA-256. `REVIEW_README.md` and the complete audit manifests are inside the archive.

## Included

- Complete relevant source under `apps/`, `packages/`, `scripts/`, `supabase/`, and `tests/`.
- Workspace and build configuration, exact lockfile, `.env.example`, CI workflow, lint, TypeScript, Prettier, Playwright, Next.js and Turbo configuration.
- All `docs/`, including Iteration 3 reports, architecture, data model, security, scoring, Knowledge Graph, coverage, roadmap, research backlog, and UX screenshots.
- `audit-data/` with both SQL dialect schemas, DB inventory, row counts, columns, indexes, constraints, foreign keys, views/triggers, real entity/fact/evidence samples, six reference cases, and actual search/scoring/optimizer executions.
- A 4.7 MiB real compact SQLite subset: 64 source pages, 64 page entities, 521 tables, 11,545 cells, 726 facts, 168 raw relationships, 2,936 links and 147 RAG chunks. Integrity is `ok`; foreign-key violations are zero.
- `audit-results/` with dependencies, production npm audit, secret scan, commands, full-workspace results, and clean-restore results.

## Uncompressed staging sizes

| Path            | Size (KiB) |
| --------------- | ---------: |
| `audit-data/`   |      7,032 |
| `docs/`         |      2,536 |
| `packages/`     |        460 |
| `apps/`         |        320 |
| `package-lock`  |        240 |
| `supabase/`     |         60 |
| `scripts/`      |         56 |
| `audit-results` |         36 |
| `tests/`        |         16 |
| Root config     |         52 |

## Deliberately excluded

- Full `data/source`, raw HTML mirror and mass source assets.
- Complete `data/canonical` and `data/processed` outputs.
- `node_modules`, `.next`, `.turbo`, build output, coverage, test results and browser caches.
- `.git`, OS metadata, logs, TypeScript build-info files and symbolic links.
- Real `.env` files, credentials, API keys, tokens and cookies.
- Previous ZIPs, the original source ZIP and nested archives.

The small HTML parser fixture under `packages/ingestion/tests/fixtures/` remains included because it is required by a real ingestion test; it is not part of the raw source mirror.

## Validation before packaging

- Format: pass.
- ESLint with zero warnings: pass.
- Typecheck: 12/12 workspaces.
- Unit/workspace integration: 49 tests.
- Playwright: 22/22 desktop Chromium and Pixel 7 tests.
- Production build: web and admin pass.
- Canonical data validation: 2,532 pages, 12,183 tables and 3,308 RAG chunks.
- Full canonical SQLite: `integrity_check=ok`, zero foreign-key violations.
- PostgreSQL migrations/invariants: pass in a disposable local PostgreSQL instance.
- Production dependency audit: zero vulnerabilities.
- Credential scan: zero signature matches and zero non-empty secret assignments outside `.env.example`.

## Final ZIP validation

- `unzip -tq`: pass, no compressed-data errors.
- Sidecar verification with `shasum -a 256 -c`: pass.
- Required contents: pass.
- Prohibited archive paths: zero, allowing only `.env.example`.
- Symbolic links: zero.
- Nested ZIPs: zero.

The exact final ZIP was extracted to a fresh temporary directory. From that extraction:

- `npm ci`: pass; 463 packages installed from the lockfile.
- `npm run typecheck`: pass, 12/12 with zero cache hits.
- `npm test`: pass, 49 tests and 15/15 tasks with zero cache hits.
- `POKOPIA_DATABASE_PATH="$PWD/audit-data/pokopia-review.sqlite" npm run build -- --env-mode=loose`: pass; web/admin 6/6 tasks with zero cache hits.

Full source/canonical validation cannot be repeated from the REVIEW ZIP by design. Its pre-package evidence is retained in `audit-results/results.json`.

## Audit finding handled

The initial E2E audit exposed one obsolete test duplicated across desktop/mobile: it still looked for a My Pokopia checkbox removed in Iteration 3. The test was updated to exercise the current `ProgressAction`, reload the page and verify the persisted dashboard count. No application behavior or visual design changed. Focused persistence passed 2/2 and the complete final suite passed 22/22.

No critical product blocker requiring `docs/PRE_ITERATION_4_BLOCKERS.md` was found. Empty ordinary-result sets for several direct-intent search cases remain visible in `audit-data/search-cases.json` for external review; they were not manually altered or treated as packaging blockers.

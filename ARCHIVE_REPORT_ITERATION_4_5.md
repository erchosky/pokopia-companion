# Archive report — Pokopia Companion Iteration 4.5

Date: 2026-08-11  
Artifact: `Pokopia-Companion-Iteration-4.5-REVIEW.zip`  
SHA-256: `007c284f0dff410b93c64883086bbf0f19c666862d1d7e00ee9b0e18ee45d060`  
Compressed bytes: 8,814,728 (8.41 MiB)  
Files: 329 beneath one top-level directory

## Archive content

Included: complete application/package source, exact npm lockfile and workspace manifests,
configuration and `.env.example`, append-only PostgreSQL migrations, unit/integration/security/E2E
tests, current documentation and threat/readiness/measurement reports, machine-readable audit results,
CI workflow, and `audit-data/pokopia-review.sqlite`.

The compact SQLite is 45,592,576 bytes and contains every source row needed to reproduce the 3,043
PostgreSQL runtime projections plus the deterministic evidence samples. Its manifest reports 2,078
pages/entities and the final package check returns `pragma integrity_check = ok` with no foreign-key
violations.

Excluded: `node_modules`, `.next`, `.turbo`, caches, coverage, test output, logs, VCS metadata,
symlinks, private environment files, secrets, previous/nested ZIPs, full source corpus, heavyweight
canonical JSONL/full SQLite, temporary PostgreSQL databases and historical PNG screenshots. The old
reports retain their screenshot paths as historical references; those images are not runtime or
restore inputs. Their exclusion keeps the fully functional review artifact below 10 MiB.

## Exact clean restore validation

The final checksum above was extracted into a new `/tmp` directory. No dependencies, builds or
private environment from the working tree were reused.

| Gate                                                | Result                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| SHA/checksum and compressed-data integrity          | PASS                                                                              |
| `npm ci` from lockfile                              | PASS — 480 packages                                                               |
| Prettier check and ESLint zero warnings             | PASS                                                                              |
| TypeScript                                          | PASS — 14/14 workspace tasks                                                      |
| Unit/integration suite                              | PASS — 102 tests, 19/19 Turbo tasks                                               |
| Production builds                                   | PASS — web and admin                                                              |
| Playwright                                          | PASS — 50/50 desktop Chromium + Pixel 7                                           |
| Security regression suite                           | PASS — auth, authorization, session, rate limit, input, headers, XSS/source gates |
| SQLite integrity/FK/evidence                        | PASS                                                                              |
| PostgreSQL 16.13 disposable migrations              | PASS                                                                              |
| Seed idempotency and 3,043 projection parity        | PASS                                                                              |
| Adversarial RLS/grants and concurrent rate limiting | PASS                                                                              |
| Production dependency audit                         | PASS — 0 known vulnerabilities, including 0 high/critical                         |
| Package paths/symlinks/secrets/nested archives      | PASS                                                                              |

## Problems caught during archive replay

The archive loop itself found and corrected three release defects instead of documenting false
passes:

1. The Iteration 4 PostgreSQL gate pointed only to a full canonical DB excluded from the ZIP.
2. The first Iteration 4.5 compact DB built the app but did not contain every seed projection source;
   the compact selection was expanded and parity replayed.
3. Regenerated JSON needed formatting after generation, and the cold real-database search regression
   required an explicit 15-second integration-test budget instead of Vitest's fragile 5-second
   default.

Each correction was repackaged and the exact final checksum was restored again from zero.

## Restore commands

```bash
unzip Pokopia-Companion-Iteration-4.5-REVIEW.zip
cd Pokopia-Companion-Iteration-4.5-REVIEW
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:postgres --workspace @pokopia/db
npm run security:test
npm run evidence:verify
npm audit --omit=dev
```

PostgreSQL dynamic validation requires local `psql`, `initdb` and `pg_ctl`. No hosted service or
secret is required for the review suite.

## Honest limitations

The package proves local source/schema/runtime behavior, not hosted Supabase/Vercel configuration,
MFA, monitoring, backups, restore RPO/RTO, production proxy semantics or load behavior. Managed Codex
Security Deep Scan could not run in this desktop task because it lacked a managed filesystem
permission profile. These constraints support `CONDITIONAL GO`, not immediate public launch.

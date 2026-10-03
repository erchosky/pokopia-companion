# Archive report — Pokopia Companion Iteration 5

Date: 2026-08-11.

## Artifact

- Archive: `Pokopia-Companion-Iteration-5-REVIEW.zip`
- Checksum: `Pokopia-Companion-Iteration-5-REVIEW.zip.sha256`
- Root directory inside ZIP: `Pokopia-Companion-Iteration-5-REVIEW/`
- Dependency-free: yes

The exact SHA-256 is intentionally stored in the sidecar to avoid embedding a circular self-hash in
the archive report.

## Included

Source code, package manifests and exact lockfile, Supabase migrations, scripts, tests, documentation,
environment template, public assets, compact review SQLite and machine-readable audit data.

## Excluded

`node_modules`, `.next`, `.turbo`, Playwright/test output, screenshots used only for local visual QA,
logs, coverage, VCS metadata, `.env*` except `.env.example`, secrets, symlinks, OS metadata and every
nested/older ZIP.

## Gates before packaging

- baseline Iteration 4.6 SHA/checksum/ZIP integrity: PASS;
- source integrity: 2,532 RAW pages PASS;
- data validation: 2,532 pages, 12,183 tables, 3,308 RAG chunks PASS;
- evidence integrity: 240 chains, zero invalid/orphan chains PASS;
- workspace typecheck: 14/14 tasks PASS;
- unit/integration tests: 117 tests PASS;
- lint and Prettier: PASS;
- production builds: web and admin PASS;
- Playwright: 66/66 desktop/mobile tests PASS;
- Iteration 5 journeys: 16/16 PASS within the full suite;
- PostgreSQL dynamic migrations/RLS/grants/rate limiting/seed: PASS;
- local security regression scan: 164 source files PASS;
- production dependency audit: 0 known vulnerabilities;
- Iteration 5 real-corpus audit and microbenchmarks: PASS;
- visual QA: 1,440 px and 412 px, zero browser console errors.

## Restore gate

**PASS.** The ZIP was restored to a fresh temporary directory without private environment files.
`npm ci` installed 488 packages from the exact lockfile; 14/14 typecheck tasks, 19/19 test tasks and
8/8 production build tasks passed from that restored copy. ZIP integrity, required content, excluded
paths, symlinks and credential-signature checks also passed.

## Honest limitations

Hosted Supabase/Vercel staging, real identity/MFA/revocation, CDN/cache, production load/pooling,
backup restore, rollback and manual assistive-technology tests remain external blockers. This archive
does not grant production GO. The private master corpus is excluded and must be restored from its
separate immutable backup for full source regeneration.

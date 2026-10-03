# Archive report — Pokopia Companion Iteration 5.5

Date: 2026-08-12.

## Artifact

- Archive: `Pokopia-Companion-Iteration-5.5-REVIEW.zip`
- Checksum: `Pokopia-Companion-Iteration-5.5-REVIEW.zip.sha256`
- Root: `Pokopia-Companion-Iteration-5.5-REVIEW/`
- Dependency-free: yes

El SHA-256 exacto vive en el sidecar para evitar un self-hash circular.

## Provenance

- Iteration 5.1 baseline SHA-256:
  `81c4183272d1e10a8e6cc56f8eb533f9ac191fac8ff3a21a62cf29498fb43a04`;
- baseline ZIP integrity: PASS;
- master verification: 2.532 RAW pages and archive/index/SQLite/REVIEW references intact.

## Included

Source, exact package manifests/lockfile, Supabase migrations, tests, docs, public assets,
machine-readable audit data and compact review SQLite.

## Excluded

`node_modules`, `.next`, `.turbo`, test/Playwright output, local screenshots, logs, coverage, VCS
metadata, `.env*` except `.env.example`, secrets, symlinks, OS metadata, canonical/master corpus, RAW
HTML and every older/nested ZIP.

## Gates before packaging

- Planner: 1–20 goals, shared graph, immutable what-if, conservative scenario comparison;
- real shared case: Antique Chandelier + Antique Clock, four shared materials;
- 20-goal benchmark: about 5 ms locally on Node 22;
- typecheck: 15/15 tasks;
- unit/integration: 156 tests;
- lint and Prettier: PASS;
- production builds: web/admin PASS;
- Playwright: 84/84 desktop + Pixel 7;
- SQLite integrity/FK: `ok` / 0 violations;
- quantitative audit: 882 recipes; 0 exact, 880 partial, 2 structural, 0 disputed;
- evidence integrity: 240 chains, 0 invalid/orphan/duplicate chains;
- PostgreSQL migrations/RLS/grants/idempotent seed/parity: PASS;
- production dependency vulnerabilities: 0;
- secret scan: PASS.

## Restore gate

PASS from a new `/tmp` directory without private environment files:

- ZIP extraction and exact lockfile install: `npm ci`, 489 packages;
- Prettier, ESLint and 15/15 typecheck tasks: PASS;
- unit/integration: 21/21 workspace tasks, 156 tests;
- production builds: web/admin PASS;
- Planner audit: 7 performance cases, deterministic regression and real shared pair PASS;
- quantitative audit: 882 recipes, 13/15 automation systems, 115 evidence records / 114 facts;
- evidence integrity: 240 assertion chains; SQLite integrity `ok`, 0 FK violations;
- security regressions: 185 source files PASS; secret scan PASS;
- dynamic PostgreSQL migrations, constraints, adversarial RLS/grants, atomic rate limiting,
  idempotent seed and canonical parity: PASS;
- `npm audit --omit=dev`: 0 vulnerabilities;
- Playwright: 84/84 desktop + Pixel 7.

## Honest limitations

No hosted Supabase/Vercel target was modified. Hosted advisors, identity/MFA/revocation, production
load, backup restore, rollback and manual assistive-technology validation remain external gates.
Recipe output batches, general production throughput and a real spatial player layout remain missing;
this review archive is not production GO.

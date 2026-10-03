# Archive report — Pokopia Companion Iteration 5.1

Date: 2026-08-12.

## Artifact

- Archive: `Pokopia-Companion-Iteration-5.1-REVIEW.zip`
- Checksum: `Pokopia-Companion-Iteration-5.1-REVIEW.zip.sha256`
- Root: `Pokopia-Companion-Iteration-5.1-REVIEW/`
- Dependency-free: yes

El SHA-256 exacto vive en el sidecar para evitar un self-hash circular.

## Provenance

- Iteration 5 baseline SHA-256:
  `47a57a0c945c66c7381a3f6e5d61cfaf3fa337fc262ce0811fda9c6f71113bcf`;
- master archive SHA-256:
  `251f4b0e5d87a3857d6ddf98294a99a2f9f682f3f022fb93be4ffd95bf00987c`;
- master verification: 2.532 RAW pages and archive/index/SQLite/REVIEW references intact.

## Included

Source, exact package manifests/lockfile, Supabase migrations, parsers, scripts, tests, docs, public
assets, machine-readable audit data, evidence manifests and compact review SQLite.

## Excluded

`node_modules`, `.next`, `.turbo`, test/Playwright output, local QA screenshots, logs, coverage, VCS
metadata, `.env*` except `.env.example`, secrets, symlinks, OS metadata, canonical/master corpus,
RAW HTML and every older/nested ZIP.

## Gates before packaging

- baseline checksum and ZIP integrity: PASS;
- master source integrity: 2.532 RAW pages PASS;
- data validation: 2.532 pages, 12.183 tables, 3.308 RAG chunks PASS;
- SQLite integrity/FK: `ok` / 0 violations;
- quantitative audit: 882 recipes; 0 exact, 880 partial, 2 structural, 0 disputed;
- automation: 13/15 quantitative (9/11 original); 115 evidence / 114 unique facts;
- evidence integrity: 240 chains, 0 invalid/orphan/duplicate chains;
- typecheck: 14/14 tasks;
- unit/integration: 130 tests;
- lint and Prettier: PASS;
- production builds: web/admin PASS;
- Playwright: 68/68 desktop + Pixel 7;
- visual QA: 1.440×1.000 and 412×915, 0 browser warnings/errors;
- PostgreSQL migrations/RLS/grants/idempotent seed/parity: PASS;
- production dependency vulnerabilities: 0;
- secret scan: 288 source/configuration files, PASS;
- core microbenchmarks: PASS.

## Restore gate

PASS from a new `/tmp` directory without private environment files:

- ZIP integrity, checksum, 417 required project files, prohibited-path scan and symlink scan: PASS;
- exact lockfile install: `npm ci`, 488 packages;
- typecheck: 14/14 tasks;
- unit/integration: 19/19 workspace tasks, 130 tests;
- ESLint and Prettier: PASS;
- production builds: web/admin PASS;
- quantitative audit: 882 recipes, 13/15 automation systems, 115 evidence records / 114 facts;
- evidence integrity: 240 assertion chains PASS;
- dynamic PostgreSQL migrations, constraints, adversarial RLS/grants, atomic rate limiting,
  idempotent seed and canonical parity: PASS;
- Playwright: 68/68 desktop + Pixel 7;
- `npm audit --omit=dev`: 0 vulnerabilities.

## Honest limitations

No hosted Supabase/Vercel target was modified. Hosted advisors, identity/MFA/revocation, production
load, backup restore, rollback and manual assistive-technology validation remain external gates. This
review archive is not production GO.

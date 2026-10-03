# Archive report — Pokopia Companion Iteration 4.6

Date: 2026-08-11  
Artifact: `Pokopia-Companion-Iteration-4.6-REVIEW.zip`  
SHA-256: `70a65d05855f7a82daa61d03cd54026d0444d0921f81d703ca206b151425c4c5`  
Compressed bytes: 8,912,676  
Files: 345 beneath one top-level directory

## Contents and exclusions

Included: application/package source, exact lockfile, configuration and `.env.example`, append-only
migrations, tests, documentation, Iteration 4.6 findings/manifests and the compact 45,592,576-byte
REVIEW SQLite.

Excluded: dependencies, builds, caches, logs, private environments, provider tokens, symlinks,
previous/nested archives, screenshots, full canonical outputs, processed Markdown/pages, the mirror,
assets, RAW corpus and the 1,044,301,394-byte master archive. The included 666-byte HTML file is a
synthetic parser fixture already present in 4.5, not captured corpus material.

## Exact clean restore

The final checksum was extracted into a new temporary directory with no dependencies present. The
exact artifact then passed:

- `npm ci`: 488 packages;
- Prettier, ESLint and 14/14 typecheck tasks;
- 19/19 test tasks and 102 tests;
- security suite and 158 packaged source files scanned;
- compact audit fallback, SQLite integrity/FK and 240 evidence chains;
- PostgreSQL 16.13 migrations, adversarial RLS/grants, atomic limiter, idempotent seed and parity;
- web/admin production builds;
- 50/50 Playwright cases on desktop and Pixel 7;
- production dependency audit with zero known vulnerabilities;
- ZIP compressed-data integrity, 0 symlinks, 0 dependency/build/cache directories, 0 private envs,
  0 nested archives and no detected token-shaped secrets.

`npm run data:verify-master` is intentionally not a standalone archive gate: it requires the private
corpus mount. Its full read-only gate passed in the original workspace before packaging and the
expected hashes/counts are preserved in the included manifest.

## Honest boundary

No hosted target was available. Supabase required reauthentication and the available Vercel team had
zero projects. Consequently hosted MFA/revocation/RLS/rate/proxy/cache/load/monitoring/restore/
rollback/accessibility remain BLOCKED and the verdict is **CONDITIONAL GO**, not production approval.

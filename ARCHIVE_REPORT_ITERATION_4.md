# Archive report — Pokopia Companion Iteration 4

Date: 2026-08-11  
Archive: `Pokopia-Companion-Iteration-4-REVIEW.zip`

Final delivered artifact: 4,592,890 bytes, 376 entries.  
SHA-256: `d9cf1b6be84049b1a287165831fcbf00a6ccf7563375896ab9bae653fa2d9d98`

## Contents

The review package contains the complete monorepo source, exact `package-lock.json`, Supabase
migrations, unit/integration/browser tests, documentation, machine-readable audit evidence and the
compact `audit-data/pokopia-review.sqlite` runtime dataset.

It excludes dependencies, builds, caches, logs, VCS metadata, symlinks, private environments,
previous ZIPs and the full canonical/source corpus.

## Source-checkout verification

- Source archive integrity: PASS.
- Canonical ingestion validation: PASS — 2,532 pages, 12,183 tables, 3,308 RAG chunks.
- SQLite integrity and foreign keys: PASS.
- Prettier, ESLint and TypeScript: PASS.
- Unit/integration suite: PASS — 17 Turbo tasks.
- Production builds: PASS — web and admin.
- Browser suite: PASS — 44 journeys, desktop Chromium and Pixel 7.
- Disposable PostgreSQL 16: PASS — append-only migrations, constraints, idempotent seed and
  SQLite/PostgreSQL parity.
- Production dependency audit: PASS — zero known vulnerabilities.
- Secret scan: PASS.

## Independent compact restore

Status: PASS from a fresh dependency-free staging copy.

- `npm ci`: PASS — 479 packages restored from the exact lockfile.
- Prettier, ESLint, TypeScript, unit/integration tests and both production builds: PASS.
- Browser suite against the compact SQLite: PASS — 44/44 journeys on desktop Chromium and Pixel 7.
- Compact SQLite domain check: PASS — includes Machop/Machoke regression fixtures plus 5 Requests,
  6 Treasure Maps, 53 Music CDs and 14 Ditto Moves.

Expected install warning: the transitive `whatwg-encoding@3.1.1` package is deprecated. The
production dependency audit remains at zero known vulnerabilities; no forced dependency upgrade was
applied merely to hide this warning.

## Integrity and limitations

The SHA-256 checksum is published in the adjacent
`Pokopia-Companion-Iteration-4-REVIEW.zip.sha256` file because an archive cannot contain its own
final checksum without changing that checksum.

The compact SQLite is source-derived and sufficient for application/build/E2E review, but it is
not the full game corpus. Full-corpus ingestion validation and disposable PostgreSQL parity were
therefore executed in the source checkout before packaging. Hosted Supabase was not modified or
tested, as explicitly required.

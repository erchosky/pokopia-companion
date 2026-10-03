# Iteration 4 report

Date: 2026-08-11  
Baseline: Iteration 3.5  
Theme: progression, domain coverage and player intelligence

## Implemented

- `GameDataRepository` now exposes five Requests, six Treasure Maps, 53 Music CDs and 14 Ditto
  Moves in both SQLite and PostgreSQL adapters.
- Version classification is explicit: 43 CDs verified base game, 10 verified Expansion Pass; the
  other new domains remain unknown.
- An append-only migration adds content classifications, typed map metadata/requirements,
  collectible fields and Ditto Move tables with RLS and grants.
- The runtime seed and parity harness import all 3,043 projections and verify representative nested
  values, including Map 6’s warning and Water Gun’s Soup boost.
- The graph adds forward map requirement/reward/unlock edges and move→Pokémon learning edges.
- Goal Engine V3, Next Actions V2, Search V4 and My Pokopia V4 understand the new entity kinds.
- Public UI adds a progression hub and list/detail routes for every accepted domain. Admin exposes
  typed coverage/status and the two deferred gaps without bulk promotion.
- The final UX pass adds accessible names to card links, unambiguous filter labels, a bounded
  24-row checklist window with progressive disclosure, and direct typed search results for
  answer-shaped queries such as `como aprender Water Gun`.

## Deliberately not implemented

- Forms: parent/default and difference evidence is incomplete.
- Lost Relics: the source describes appraisal pools, not a stable unique collectible checklist.
- Inventory quantities, cloud sync, hosted Supabase writes, auth, LLM and map editor remain out of
  scope.

## Security hardening

The pre-audit findings were addressed with bounded fuzzy search, a pre-parse Goal API body budget,
admin login throttling, a minimal public health response and snapshot/output path containment in
ingestion. The shared-password admin remains intended for private/local deployment; individual MFA
identity is still the recommended hosted model.

## Evidence

- `audit-data/iteration-4/domain-coverage.json`
- `audit-data/iteration-4/progression-cases.json`
- `audit-data/iteration-4/quest-request-cases.json`
- `audit-data/iteration-4/treasure-map-cases.json`
- `audit-data/iteration-4/collectible-cases.json`
- `audit-data/iteration-4/ditto-cases.json`
- `audit-data/iteration-4/version-filtering-cases.json`
- `audit-data/iteration-4/goal-cases.json`
- `audit-data/iteration-4/graph-traversal-cases.json`
- `audit-data/iteration-4/search-v4-cases.json`
- `audit-data/iteration-4/security-hardening.json`
- `audit-data/iteration-4/postgres-parity.json`
- `ITERATION_4_AUDIT.md`

## Remaining risk

Gameplay content still comes from a community snapshot and runtime assertions remain review-gated
candidates. Version evidence outside the CD table is incomplete. Search is bounded in-process but a
public deployment should also provide edge rate limiting. The admin throttle is process-local and
must be complemented by durable/network controls for multi-instance exposure.

## Final verification

- Source integrity: PASS against snapshot `serebii-pokopia-20260809T005646`.
- Canonical validation: PASS, 2,532 pages, 12,183 tables and 3,308 RAG chunks.
- Unit/integration: PASS, 17 Turbo tasks.
- ESLint, TypeScript, Prettier and production builds: PASS.
- Browser: PASS, 44 journeys across desktop Chromium and Pixel 7 after the final additions.
- PostgreSQL: PASS on a disposable local PostgreSQL 16 instance, including migrations, constraints,
  idempotent seed and SQLite/PostgreSQL parity.
- Production dependencies: zero known vulnerabilities; secret scan PASS.
- Expected warning: Node prints `NO_COLOR`/`FORCE_COLOR` during Playwright web-server startup. It has
  no functional effect and is not an application error.

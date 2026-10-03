# Pokopia Companion — Execution Plan

Status: local V3.1 delivery complete; external promotion and deployment gated

Started: 2026-08-09  
Source snapshot: `Pokopia-KB-FULL-20260809-005646.zip`  
Source SHA-256: `251f4b0e5d87a3857d6ddf98294a99a2f9f682f3f022fb93be4ffd95bf00987c`

## Non-negotiable boundaries

- The ZIP master is immutable and is excluded from Git.
- Every generated artifact is written under `data/processed`, `data/canonical`, or `data/audits`.
- Structured facts keep source document, URL, snapshot, parser version, hash, confidence, and verification status.
- Facts, inferences, recommendations, and user state are separate layers.
- Community or secondary evidence never becomes a canonical fact without review.
- Missing game knowledge is represented as `unknown`, `conflicting`, or `needs_testing`; it is never invented.
- Public game data, private user state, and administrative capabilities have different grants and RLS policies.

## Delivery sequence

### 0. Evidence-preserving audit

- Inventory archive paths, sizes, counts, SQLite schema, structured rows, errors, categories, assets, and coverage.
- Measure replacement characters, mojibake indicators, repeated content, navigation residue, short extraction, empty tables, orphan references, and missing provenance.
- Publish `DATA_AUDIT.md` with reproducible commands and limitations.

Exit: evidence-backed audit plus machine-readable quality report.

### 1. Reprocessor V3.1

- Decode HTML from byte evidence using BOM/meta charset plus safe fallbacks.
- Isolate main content, headings, meaningful links, key/value facts, and real tables.
- Normalize identifiers without destroying display Unicode.
- Emit clean Markdown, normalized JSON/JSONL, SQLite/FTS, RAG chunks, statistics, warnings, and hashes.
- Reject or flag implausibly short pages instead of silently accepting them.

Exit: deterministic rerun against local `RAW_HTML`, zero U+FFFD in accepted output, and explicit quarantine/warnings.

### 2. Canonical domain and versioning

- Use normalized relational tables for stable game concepts and JSONB only for exceptional attributes.
- Add bitemporal-style validity by game version without overwriting historical assertions.
- Represent source snapshots, documents, evidence, assertions, conflicts, verification, gaps, and research tasks.
- Implement explicit grants and RLS for user/admin tables while keeping the schema portable PostgreSQL.

Exit: versioned SQL migrations, schema tests, portable repository interfaces, and documented model.

### 3. Reviewed ingestion and real seed

- Load processed candidates into staging.
- Validate identity, references, source coverage, version ranges, and conflict rules.
- Promote high-confidence deterministic records and retain review queues for ambiguity.
- Generate snapshot diffs for new, removed, modified, and conflicting records.

Exit: canonical database and local fallback dataset populated only from real snapshot evidence.

### 4. Core product

- Build mobile-first web and separate private admin applications with a shared accessible design system.
- Deliver universal search, Pokédex, items, recipes, towns, source evidence, basic My Pokopia, explained scoring, and data-health admin.
- Keep reads in Server Components, mutations in authenticated Server Actions, and external APIs in Route Handlers.

Exit: the requested first functional journey works with real data and graceful unknown states.

### 5. Engines and planning

- Add weighted, explainable scoring; crafting dependency traversal; prerequisites/rules; goals; and optimizer contracts.
- Preserve derived outputs and their input/version metadata so recommendations are reproducible.

Exit: tested calculations with explanations and no fabricated game facts.

### 6. Hardening and release readiness

- Unit, integration, parser fixture, schema, API, and browser-flow tests.
- Query/index review, pagination, cache policy, bundle checks, accessibility, RLS assertions, CI, Vercel and provider-neutral deployment documentation.
- Final gates: format, lint, typecheck, tests, build, and Playwright smoke journey.

Exit: all locally runnable gates pass; external credential-only checks are documented precisely.

## Architecture decisions

1. npm workspaces + Turborepo coordinate applications and packages without coupling domain code to a host.
2. PostgreSQL migrations are hand-reviewable SQL; the runtime DB adapter is a narrow interface.
3. Supabase is an optional Postgres/Auth/Storage host, not a domain dependency.
4. The web application can read generated canonical JSON locally when `DATABASE_URL` is absent, enabling deterministic development and CI.
5. Canonical identifiers are stable slugs plus UUID database keys; aliases preserve source spelling and searchability.
6. Search begins with PostgreSQL FTS + `pg_trgm`; semantic search is a later adapter.
7. The ingestion pipeline is snapshot-first and review-gated: source → parser → normalization → validation → staging → review → canonical.

## Known external gates

- Live Supabase migration/RLS verification requires a project and credentials.
- Vercel deployment verification requires a linked project/session.
- Unknown gameplay behavior requires official evidence or controlled manual testing.

## Delivery record — 2026-08-09

| Phase                            | Result                          | Evidence                                                                                                                                   |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Evidence-preserving audit        | Complete                        | Master SHA-256 verified; 2,532 pages and source SQLite inventoried without modifying the ZIP.                                              |
| Reprocessor V3.1                 | Complete                        | 2,532/2,532 pages, 12,183 tables, 3,308 RAG chunks; 48 detected mojibake sequences reduced to 0 and no U+FFFD.                             |
| Canonical domain and versioning  | Complete                        | Portable SQL migrations, repository contracts, RLS/grants, and dynamic PostgreSQL 16 test pass.                                            |
| Reviewed ingestion and real seed | Partial by design               | Canonical SQLite is populated from real evidence. PostgreSQL promotion remains review-gated; no unreviewed candidate is silently promoted. |
| Core product                     | Complete for the first vertical | Web and private admin applications read the canonical dataset; core search/detail/progress journeys pass desktop and mobile E2E.           |
| Engines and planning             | Foundation complete             | Explainable scoring, rule, search, and optimizer contracts exist; advanced automation and unknown gameplay knowledge remain roadmap work.  |
| Hardening and release readiness  | Complete locally                | Format, ESLint, strict typecheck, 29 unit tests, PostgreSQL integration test, production builds, and 10 Playwright scenarios pass.         |

No live Supabase or Vercel resource was changed. Those checks require credentials and an explicit deployment target.

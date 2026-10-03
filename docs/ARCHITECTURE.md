# Pokopia Companion Architecture

## Runtime dual de Iteration 3.5

Las Server Components obtienen `GameDataRepository` de forma asíncrona. `POKOPIA_DATA_BACKEND` selecciona SQLite o PostgreSQL sin introducir condiciones de motor en search, KG, goals, optimizer, rules o scoring. PostgreSQL carga una proyección reproducible respaldada por entidades normalizadas, staging, assertions y evidence.

## Iteration 5 game-logic boundary

`@pokopia/rules` is provider-neutral and deterministic. Repositories provide evidence-aware domain
records; My Pokopia provides explicit player state; the engine returns evaluations/traces and cloned
what-if snapshots; intelligence and UI only turn those outputs into recommendations. Derived-default
quantities and missing player state remain unknown.

## Architectural objective

Pokopia Companion treats the game as a versioned domain, not as a collection of copied web pages. The system is a modular monorepo whose core can run on any PostgreSQL 15+ provider. Supabase is a supported host for PostgreSQL, Auth, Storage, and RLS, but no domain contract imports Supabase types.

The original `Pokopia-KB-FULL` snapshot is immutable. Every transformation moves through this one-way flow:

```text
immutable source snapshot
  -> deterministic parser
  -> normalized records
  -> validation
  -> staging_records
  -> human/review policy
  -> typed canonical tables + accepted assertions
  -> search/scoring projections
  -> applications
```

No scraper or parser writes directly to accepted facts. A failed or ambiguous record stays in staging, a conflict, or a knowledge gap.

## Modules and dependency direction

| Module               | Responsibility                                                           | May depend on                |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| `packages/domain`    | Provider-neutral types, version semantics, repository interfaces         | Nothing outside TypeScript   |
| `packages/db`        | SQL executor adapter, PostgreSQL repositories, seed contract, migrations | `domain`                     |
| `packages/ingestion` | Decode, parse, normalize, validate, stage, diff                          | `domain`, seed contract      |
| `packages/rules`     | Conditions, prerequisites, effects                                       | `domain`                     |
| `packages/scoring`   | Explainable derived scores and recommendations                           | `domain`, rules              |
| `packages/search`    | Search orchestration and future semantic adapter                         | `domain`                     |
| `apps/web`           | Public catalog and private My Pokopia                                    | repositories/services        |
| `apps/admin`         | Review queue, source health, conflict resolution                         | authenticated admin services |

Applications depend inward on contracts. The domain layer never imports Next.js, Supabase, Vercel, PostgREST, or an ORM.

## Data boundaries

1. **Canonical identity and typed relationships:** `entities` plus domain tables such as `pokemon`, `items`, `recipes`, and `towns`. Foreign keys preserve important relationships.
2. **Knowledge and provenance:** `source_assertions` contains fact, inference, or recommendation candidates; `source_evidence` links them to exact source documents. Accepted facts have a row in `facts`.
3. **Derived outputs:** scores and explanations record model/version/input hashes. A score is not a fact.
4. **User state:** progress, inventory, plans, goals, notes, and saved recommendations have an owner UUID and independent RLS.
5. **Administrative staging:** ingestion runs, candidate payloads, diffs, decisions, and audit logs are admin-only.

JSONB is restricted to variable source extraction metadata, untrusted staging payloads, audit before/after data, and free-form town-plan layouts. Stable game concepts and their important relations use columns and foreign keys.

## Repository model

`packages/domain/src/repositories.ts` defines read contexts with an optional `asOfVersionId`. `packages/db/src/sql.ts` accepts any parameterized SQL executor, so `pg`, `postgres.js`, or another server-side PostgreSQL driver can implement it. Repositories never construct SQL from user values.

The web application should use Server Components for reads and authenticated server mutations for user state. Browser clients may read catalog tables through the Supabase Data API because catalog grants are select-only and RLS is enabled. Administrative writes must never use a browser-exposed service-role key.

## Search and scoring

`search_entries` is a rebuildable PostgreSQL FTS projection over canonical entities and aliases. It is deliberately not the source of truth. The first implementation uses the built-in `simple` text-search configuration so Unicode names remain searchable without a provider extension. `pg_trgm` or vector search can be added as optional adapters.

Scoring models, criteria, contextual weights, observations, and per-criterion explanations are persisted separately. `input_hash`, game version, preset, and model version make every ranking reproducible.

## Operational invariants

- Every public-schema table has RLS enabled.
- Grants and RLS are separate and explicit.
- User metadata never authorizes admin access; the app uses a server UUID allowlist plus provider
  state, while database RLS accepts only trusted JWT `app_metadata` claims.
- Version ranges use inclusive introduction and exclusive removal.
- Historical assertions are superseded, never silently overwritten.
- Migrations are append-only after release.
- Dynamic migration tests use a disposable local PostgreSQL cluster or an explicitly supplied disposable URL.

## Hosted administrative boundary

The portable shared-password session is development/test-only. Staging and production require a
Supabase access token authenticated against the provider on every protected request, an immutable
server-side UUID allowlist, `aal2`, and a privileged active-user lookup so deletion/ban revocation is
observable. Browser metadata and role headers never authorize access. Admin responses are private
and no-store; hosted access/primary-factor cookies are HttpOnly, Secure and SameSite Strict.

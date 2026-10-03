# Pokopia Companion

Pokopia Companion is a source-traceable, version-aware companion platform for Pokémon Pokopia. It combines a canonical game database, deterministic ingestion, fast search, explainable planning engines, private progress tracking, and a data-quality administration surface.

The local V3.1 foundation and first product vertical are complete. Start with [the execution plan](docs/EXECUTION_PLAN.md), [the architecture](docs/ARCHITECTURE.md), [the data audit](docs/DATA_AUDIT.md), and [the UX/UI audit](docs/UX_UI_AUDIT.md).

## Safety

The private Serebii research snapshot is never committed or published. The application consumes derived structured facts and original product copy; it does not expose the mirror or hotlink source assets.

## Delivered locally

- Deterministic V3.1 ingestion of all 2,532 captured pages into a canonical SQLite database and provenance-preserving JSONL artifacts.
- A version-aware PostgreSQL domain with review-gated promotion contracts, explicit grants, and RLS migrations.
- A mobile-first Next.js companion with real-data search, Pokédex, items, recipes, towns, explained recommendations, and private local progress.
- A separate fail-closed administration application for sources, entities, gaps, and data health.

The populated local application database is `data/canonical/v3.1/pokopia-canonical.sqlite`. Set `POKOPIA_DATABASE_PATH` only to override it.

## Local commands

```bash
npm install
npm run data:process
npm run data:validate
npm run dev             # web: http://localhost:3000
npm run dev:admin       # admin: http://localhost:3001
```

Before opening the admin application, copy `.env.example` to `.env.local` and set its two admin-only secrets. The admin fails closed when they are absent.

## Quality gates

```bash
npm run data:verify-source
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:postgres --workspace @pokopia/db
npm run build
npm run test:e2e
```

The PostgreSQL test uses an ephemeral local PostgreSQL 16 instance. Live Supabase migration, reviewed promotion into hosted PostgreSQL, and Vercel deployment require project credentials and are intentionally not performed by the local build. Never commit secrets.

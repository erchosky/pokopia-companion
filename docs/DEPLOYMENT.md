# Database Deployment

## Mandatory hosted preflight

Set `POKOPIA_DEPLOYMENT_TARGET=staging` or `production` before building. Both Next.js projects run
component-specific fail-closed environment validation from their configuration; `npm run
security:env` validates the combined contract. The web project does not need the admin provider
secret. The admin project must receive `SUPABASE_SECRET_KEY` only as a server secret and must never
expose it through a `NEXT_PUBLIC_` name.

No deployment is authorized for production by this document. Staging requires the isolated topology
and replay in `STAGING_ENVIRONMENT.md`; promotion requires every hosted blocker in
`PRODUCTION_READINESS.md` to be resolved.

## Estado Iteration 3.5

Esta iteración no despliega. Para pruebas locales se debe elegir explícitamente `POKOPIA_DATA_BACKEND=sqlite|postgres`; PostgreSQL requiere `POKOPIA_DATABASE_URL` o `DATABASE_URL`. SQLite sigue siendo la opción offline y de review.

## Requirements

- Node.js 22 or later for project tooling.
- PostgreSQL 15 or later; managed Supabase and ordinary PostgreSQL are supported.
- `psql` for the provider-neutral migration runner, or a current Supabase CLI for Supabase workflows.
- No database or hosting credentials are committed to the repository.

## Local verification

```bash
npm install
npm run typecheck --workspace @pokopia/domain
npm run typecheck --workspace @pokopia/db
npm run test --workspace @pokopia/domain
npm run test --workspace @pokopia/db
npm run test:postgres --workspace @pokopia/db
```

The last command uses an isolated temporary PostgreSQL data directory when local PostgreSQL binaries are available. It does not touch a developer database. To test another disposable instance, set `POKOPIA_TEST_DATABASE_URL` for that command only.

## Provider-neutral PostgreSQL

1. Create an application database and restricted runtime roles.
2. Set `DATABASE_URL` only in the server/deployment secret store.
3. Run `npm run migrate --workspace @pokopia/db` from a trusted environment.
4. Configure trusted middleware to set `request.jwt.claims` transaction-locally with a verified `sub` and, for administrators, `app_metadata.role`.
5. Use a server-only SQL adapter implementing `SqlExecutor`.
6. Run schema tests and a read/write/RLS smoke test before serving traffic.

The migration runner never prints the connection URL and records applied migration IDs in `app_private.schema_migrations`.

## Supabase

1. Install a current Supabase CLI and discover commands with `supabase --help`; CLI commands change over time.
2. Link the intended project without putting tokens or database passwords in files.
3. Review the current Supabase changelog and migration diff.
4. Apply the files under `supabase/migrations` using the current documented migration workflow.
5. Confirm the Data API exposed schemas include `public` only as intended.
6. Verify explicit grants and RLS using anon, authenticated owner, authenticated non-owner, admin, and service-role sessions.
7. Run current database/security advisors and resolve findings.

Recent platform notes checked during implementation: self-hosted Supabase is moving to PostgreSQL 17, PostgreSQL 14 support has ended, and extension version pinning is deprecated. These migrations require only PostgreSQL core features and do not pin extensions.

## Vercel application deployment

Configure database/auth variables separately for Preview and Production. Only publishable browser-safe values may use a public prefix. `DATABASE_URL` and any service-role/secret key remain server-only. Run migrations as a controlled release step, not from request handlers or every application boot.

Recommended order:

1. Back up and verify the target database.
2. Apply forward-only migrations.
3. Run schema/RLS smoke tests.
4. Deploy server/application code compatible with the new schema.
5. Rebuild search projections and derived scores if required.
6. Monitor errors, slow queries, ingestion queues, and conflicts.

Rollback is performed with a new corrective migration or a tested database restore. Released migrations are never edited in place.

## External gates

Without credentials, local schema/type/test validation is complete but live project migration, advisors, production RLS, connection pooling, and Vercel environment checks remain pending. Do not claim those checks passed until verified against the actual project.

# Database Security

## Iteration 4.6 hosted identity

Hosted admin access is fail-closed: Supabase verifies the bearer identity, the server compares the
provider user ID to `POKOPIA_ADMIN_USER_IDS`, requires JWT `aal2`, and re-reads provider admin state
on every request to detect revocation. Shared-password credentials are rejected by staging and
production environment validation. This boundary is covered locally but remains unverified against
a real provider until authorized staging is connected; see `PRODUCTION_READINESS.md`.

## Iteration 4.5 application hardening

- Public fuzzy search is capped at 120 characters, 12 tokens and 20 variants in the engine.
- `/api/goals` reads at most 64 KiB before JSON parsing and bounds bytes, depth, nodes, goal fields
  and progress entries through allowlists.
- The public health route returns only fixed liveness state; detailed paths remain in admin.
- Shared-password admin login blocks the sixth failure for 15 minutes through `RateLimitStore`.
  Memory storage is local/test only; production rejects it and uses the atomic PostgreSQL adapter.
- Forwarded addresses are ignored unless Vercel or an explicit trusted-proxy contract is configured.
- Admin sessions are versioned, nonced, HMAC signed, bounded to eight hours and verified server-side.
- Web/admin responses include CSP, frame denial, MIME/referrer/permissions/COOP controls, production
  HSTS and no-store on APIs/admin. The current CSP permits inline Next.js bootstrap code; nonce/hash
  hardening remains a deployment follow-up.
- Structured security logs redact secrets, credentials, cookies, bearer values and connection URLs.
- Ingestion resolves manifest inputs under the snapshot real path and generated outputs under their
  approved roots, rejecting traversal, absolute paths and symlink escapes.

The shared-password admin remains a development/test fallback only. Hosted deployment additionally
requires real MFA/revocation replay, distributed/edge throttling and operational monitoring.

## Seed guard de Iteration 3.5

El importador rechaza PostgreSQL remoto por defecto. Sólo admite la combinación deliberada `--allow-remote` y `POKOPIA_ALLOW_REMOTE_SEED=I_UNDERSTAND`. El seed usa transacción, timeout, assertions candidatas y no contiene truncates ni promoción automática.

## Access classes

| Class                               | `anon` | `authenticated` | Admin claim   | `service_role`   |
| ----------------------------------- | ------ | --------------- | ------------- | ---------------- |
| Canonical catalog/accepted evidence | SELECT | SELECT          | SELECT        | Full server-side |
| User state                          | None   | Own rows only   | Own rows only | Full server-side |
| Ingestion/admin tables              | None   | No rows         | CRUD          | Full server-side |
| Measurements before acceptance      | None   | No rows         | CRUD/review   | Full server-side |
| Rate-limit buckets                  | None   | None            | Server only   | Server only      |

PostgreSQL grants decide whether a role can reach an object. RLS then decides which rows are visible or mutable. Both controls are present in `202608090002_user_admin_security.sql`.

## RLS design

Every table in the exposed `public` schema has RLS enabled, including read-only catalog tables. Catalog policies permit reads, while grants prevent browser roles from writing. Provenance policies expose only accepted assertions and the documents, evidence, verifications, fact markers, and relationships attached to them; candidates, conflicts, gaps, and research tasks remain admin-only. User tables use `app_private.current_user_id() = user_id` for both `USING` and `WITH CHECK`, covering SELECT and safe ownership on INSERT/UPDATE/DELETE.

Admin policies call `app_private.is_admin()`. It reads only `request.jwt.claims.app_metadata.role`, accepting `admin` or `data_admin`. Supabase `user_metadata` is user-editable and must never be used for authorization. Helper functions are `SECURITY INVOKER`, live in an unexposed schema, have a fixed search path, and are not executable by `PUBLIC`.

The migration remains portable to PostgreSQL installations that do not define Supabase roles, so policies target `PUBLIC`; explicit object grants still restrict `anon` to catalog reads and reserve user/admin writes for `authenticated`. In a Supabase-only migration line, narrowing policy roles to `anon, authenticated` is a valid performance hardening, but is not required for row isolation here.

The portable schema does not foreign-key user IDs to `auth.users` and does not call `auth.uid()`. Supabase/PostgREST already supplies `request.jwt.claims`; another provider must set the same claim transaction-locally in trusted server middleware. Never expose a direct database credential that lets an end user set request context.

## Default-deny behavior

- `PUBLIC` loses all table, sequence, and function privileges.
- Future tables/functions/sequences receive no automatic public privileges.
- `anon` gets SELECT only on the declared catalog list.
- `authenticated` gets catalog SELECT and user/admin object privileges; RLS blocks admin rows without the claim.
- No `SECURITY DEFINER` function exists.
- The Supabase service-role/secret key is server-only and must never use a browser/public environment variable.

Adding a new public table requires updating the classified table arrays in the security migration (or a new migration). The dynamic PostgreSQL test fails if any public table lacks RLS.

## Application controls

- Authenticate on the server for every mutation; do not trust client-supplied `user_id`.
- Set `user_id` from the verified subject claim.
- Treat a service-role client as privileged infrastructure and keep it out of client bundles.
- Use parameterized queries only; the SQL executor interface takes separate parameters.
- Do not place secrets, source archives, or private user exports in Git or build artifacts.
- Record administrative changes in `admin_audit_log` without storing tokens or credentials.
- Keep JWT expiry appropriate for the risk: deleting a user does not itself invalidate existing access tokens.

## Verification

Run:

```bash
npm run test --workspace @pokopia/db
npm run test:postgres --workspace @pokopia/db
npm run security:test
npm run evidence:verify
```

The dynamic test creates and destroys its own local PostgreSQL cluster when `initdb` and `pg_ctl` are available. `POKOPIA_TEST_DATABASE_URL` is accepted only for an explicitly disposable database. For a linked Supabase project, additionally run the current CLI database advisors and inspect RLS policies before production.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api), and [Product security](https://supabase.com/docs/guides/security/product-security).

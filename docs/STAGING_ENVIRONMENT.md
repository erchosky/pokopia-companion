# Staging environment contract

## Isolation

Staging is a disposable, non-production environment with its own Vercel projects, Supabase project,
database roles, Auth tenant/users, URLs, secrets, rate-limit buckets, logs, alerts and backups. It may
contain only synthetic administrator and player data. Production credentials and user data are
forbidden.

| Concern      | Local/test                                   | Staging                                 | Production                          |
| ------------ | -------------------------------------------- | --------------------------------------- | ----------------------------------- |
| Data         | SQLite or disposable PostgreSQL              | dedicated hosted PostgreSQL             | separate hosted PostgreSQL          |
| Admin auth   | shared fallback allowed only for development | Supabase individual identity + TOTP MFA | same, independently configured      |
| Rate limiter | memory permitted                             | atomic PostgreSQL                       | atomic PostgreSQL                   |
| Origin       | localhost HTTP                               | exact HTTPS staging URL                 | exact HTTPS production URL          |
| Proxy        | headers ignored by default                   | explicit Vercel contract                | independently verified contract     |
| Secrets      | local private environment                    | staging provider secret store           | separate production secret store    |
| Monitoring   | console/test evidence                        | staging-only sink and alerts            | production sink and on-call routing |

## Required server environment

`POKOPIA_DEPLOYMENT_TARGET=staging`, `POKOPIA_PUBLIC_ORIGIN`, `POKOPIA_DATA_BACKEND=postgres`, a
least-privilege application DSN, `POKOPIA_RATE_LIMIT_BACKEND=postgres`, its restricted DSN and a
random rate-key secret are mandatory. Admin additionally requires
`POKOPIA_ADMIN_AUTH_MODE=supabase`, the project URL, browser-safe publishable key, server-only secret
key and a comma-separated UUID allowlist. Vercel must set `VERCEL=1`; a generic deployment must
explicitly opt into and document its trusted proxy.

`npm run security:env` is a fail-closed pre-build/start gate when the target is `staging` or
`production`. Shared admin password/session variables are rejected in either hosted target. Local
development keeps portable defaults.

## Deployment topology

- `web-staging`: public read surfaces and bounded API routes.
- `admin-staging`: separate private deployment, `private, no-store`, individual Auth and TOTP.
- `postgres-staging`: append-only migrations, explicit grants/RLS and separate runtime/rate roles.
- Vercel and Supabase regions should be colocated after latency measurement.
- Preview URLs are test-only; production promotion is a separate authorization event.

## Current state

The available Vercel team (`Testing Nina`) currently exposes no projects. The Supabase connector
requires reauthentication (`oauth_refresh_token_rejected`). Therefore no hosted resource was created,
mutated or represented as validated during Iteration 4.6. Local code is staging-ready; hosted replay,
MFA enrollment, monitoring, backup/restore and rollback remain BLOCKED until an authorized project is
connected.

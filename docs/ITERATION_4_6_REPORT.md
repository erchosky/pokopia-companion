# Pokopia Companion Iteration 4.6 report

## Executive verdict

**CONDITIONAL GO.** Iteration 4.6 proves local restore, data preservation and staging-ready security
boundaries. It does not prove that those controls survive a hosted topology because no authorized
staging target was reachable. Production was not touched and public launch is not approved.

## Master corpus and data-loss assurance

The authoritative `Pokopia-KB-FULL-20260809-005646.zip` was located in two local paths and verified
read-only: 1,044,301,394 bytes, SHA-256
`251f4b0e5d87a3857d6ddf98294a99a2f9f682f3f022fb93be4ffd95bf00987c`, valid ZIP, 27,986 members and
2,532 RAW pages totalling 379,301,412 bytes. Every RAW path, byte size and SHA matches
`MASTER_INDEX`; legacy SQLite integrity and page count pass. Canonical v3.1 and all compact runtime
source URL/hash references also pass.

The three layers are explicit: the private immutable master source archive; the typed canonical
knowledge store; and the compact rebuildable runtime projection. **Runtime projection is NOT an
archival backup.** The REVIEW package contains only manifests and compact derived data, never RAW,
mirror assets or the master ZIP. Two local archive copies do not prove off-device disaster recovery;
that remains PK46-004.

## Baseline and reproducibility

The exact 4.5 archive hash matched, restored cleanly and passed install, formatting, lint, 14
typechecks, 102 tests, builds, security regression, 50 browser tests, SQLite/evidence and disposable
PostgreSQL. The replay found PK46-001: the compact package could not run its review-audit command.
The command now regenerates with full canonical data or strictly verifies the included compact audit.

## Staging architecture and identity

Staging is specified as separate web/admin deployments, database/Auth tenant, secrets, users, rate
store, URLs, logs, monitoring and backups. Hosted targets fail build/start validation on placeholders,
shared admin credentials, SQLite/memory backends, missing database/provider keys or ambiguous proxy.
The public web project does not receive the admin service secret.

Admin hosted mode uses individual Supabase identity. Primary login must be followed by a verified
TOTP factor. Every protected request re-authenticates the access token with the provider, compares
the provider user UUID to a server-only allowlist, requires `aal2`, and performs a privileged active
user lookup so deletion/ban revocation denies immediately at the application boundary. Cookies are
HttpOnly, Secure, SameSite Strict and short-lived; admin output is private/no-store. Local regressions
cover anonymous, malformed/expired, non-allowlisted, missing-MFA, revoked and valid-AAL2 states.

This is staging-ready code, not hosted MFA/revocation evidence. Supabase returned
`oauth_refresh_token_rejected`; Vercel exposed the `Testing Nina` team with zero projects. No project,
user, migration, secret or deployment was created.

## Database, rate limiting, proxy and HTTP

PostgreSQL 16.13 disposable replay passes append-only migrations, grants/RLS, ownership, adversarial
roles, atomic concurrent limiting, idempotent seed and 3,043 projection parity. Memory limiting is
forbidden hosted. Vercel identity headers are consumed only under `VERCEL=1`; generic forwarding
headers require explicit trust. Request IDs now propagate through web/admin responses and safe logs.

Security headers, origin checks, API/admin no-store, auth `Vary`, HSTS configuration and secure cookie
attributes pass locally. Hosted RLS/token replay, multi-instance rate replay, proxy spoofing, TLS
capture and CDN cache behavior remain BLOCKED.

## Performance and operations

Local builds and 50 E2E cases pass; the current compact-database benchmark recorded search median/p95
16.266/16.730 ms, graph 0.005/0.006 ms and goal evaluation 0.002/0.002 ms. These are local references,
not hosted SLO evidence. Cold starts, pool saturation, controlled load, timeouts/retries under network
failure, durable logs, dashboards and alerts require staging. Proposed SLOs and stop conditions are
documented without presenting targets as measurements.

No hosted database existed, so provider backup, safe restore, measured RPO/RTO, application rollback
and forward database correction could not be rehearsed. Source, database and code backup subjects are
separated in `DATA_BACKUP_STRATEGY.md`.

## Accessibility and evidence quality

Automated desktop and Pixel 7 flows pass, including keyboard/status recovery behavior. A real hosted
manual VoiceOver/zoom/contrast/focus review was not possible and remains BLOCKED rather than replaced
by automation. Evidence integrity passes for 240 chains with zero orphans/invalid links, while 273
source records remain unverified. The new queue prioritizes progression/prerequisites/unlocks,
version/DLC, goals/next actions and automation data; nothing is auto-promoted.

## Iteration 5 readiness

Identities and parts of recipes, requirements, unlocks and capabilities are available, but quantities
are incomplete and duration, throughput, capacity, range/radius, consumption and several restrictions
remain measurement-required or unknown. `ITERATION_5_DATA_READINESS.md` is the binding gap matrix.
No rules engine, simulation engine or planner was added in this iteration.

## Final local gates

- 14/14 TypeScript tasks, 19/19 test tasks and 102 tests.
- Web/admin production builds; ESLint and Prettier; 161-file security regression.
- 50/50 Playwright desktop + Pixel 7.
- SQLite integrity/FK, 240 evidence chains, master data-loss gate.
- PostgreSQL 16.13 dynamic replay, RLS/grants, atomic limiter, idempotency and parity.
- Zero known production dependency vulnerabilities at audit time.

## Remaining blockers

1. Reauthenticate and authorize an isolated Supabase staging project.
2. Identify/create isolated Vercel web/admin staging projects.
3. Run real MFA and login-revoke-replay with named test users.
4. Replay hosted migrations/RLS/grants and multi-instance limiter/proxy/CDN attacks.
5. Measure load, cold starts, database pooling and timeouts; configure monitoring and alerts.
6. Complete database backup/restore and application rollback drills.
7. Complete manual hosted accessibility and off-device master archive restore.
8. Optionally run managed Deep Scan in an eligible permission profile.

There are no known open Critical or High code findings. Hosted absence prevents GO FOR PRODUCTION and
keeps the exact final verdict at **CONDITIONAL GO**.

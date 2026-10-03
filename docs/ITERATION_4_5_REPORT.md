# Pokopia Companion Iteration 4.5 report

## Executive summary

Iteration 4.5 hardened the completed Iteration 4 without adding a new product domain or deploying a
remote service. The review followed baseline restore, threat model, adversarial reproduction, narrow
fix, regression and re-audit. Nine findings are recorded: seven fixed code/reproducibility risks and
two honest assurance/evidence limitations. There are no known Critical or High findings.

The final verdict is **CONDITIONAL GO**: suitable to begin controlled staging preparation, not yet
approved for public production traffic.

## Baseline state

The authoritative ZIP SHA-256 matched
`d9cf1b6be84049b1a287165831fcbf00a6ccf7563375896ab9bae653fa2d9d98`. A clean extraction passed ZIP
integrity, secret/symlink/content review, `npm ci`, format, lint, 13 workspace typechecks, 17 test
tasks, web/admin builds and 44/44 E2E. Independent replay disproved one prior claim: the baseline
PostgreSQL gate cannot run from its clean review archive because it references an excluded full
canonical SQLite instead of the included compact database. Iteration 4.5 fixes that resolver.

## Findings

Machine-readable reproductions, impact, likelihood, fixes and regression paths live in
`audit-data/iteration-4-5/findings.json`. The material fixes are distributed authentication
throttling, trusted-proxy identity, recoverable/strict local-state parsing, clean-package PostgreSQL
reproducibility, explicit security headers, stronger admin sessions/origin checking, and bounded V2
migration. Evidence-source reliability and the unavailable managed Deep Scan remain explicitly open
limitations rather than false passes.

## Security changes

- `@pokopia/security` supplies HMAC-keyed rate limiting, memory and PostgreSQL stores, request
  identity normalization, production environment validation, redacted structured logging and shared
  response headers.
- External JSON is byte/depth/node bounded and mapped through explicit goal/entry allowlists.
- Search and goal evaluation have endpoint policies; protected store failure denies work.
- Source scanning rejects client/server boundary regressions, risky HTML sinks, private env files and
  public service-role naming.
- Graph traversal caps depth, nodes and relations and reports truncation instead of exhausting work.

## Authentication readiness

My Pokopia remains local-first and requires no login. Admin keeps a portable local fallback with a
strong shared password and versioned, nonced, signed, eight-hour HttpOnly/Secure/SameSite session.
Malformed, expired and wrong-secret sessions fail closed. This is not complete production identity:
individual accounts, MFA, revocation, refresh and hosted issuer/audience verification remain a
pre-production action.

## Authorization model

Authentication and authorization are separate. Every current admin page is protected by a
server-side session boundary; the authorization API has no client role/header input. PostgreSQL
authorization independently uses grants plus RLS. Admin status comes only from trusted
`app_metadata`, never user-editable metadata. Current admin pages are read-only; any future mutation
must repeat authorization, same-origin validation, strict input mapping, transaction/idempotency and
append-only audit logging.

## Distributed rate limiting architecture

`RateLimitStore` isolates policy from storage. Memory is deterministic local/test behavior and is
forbidden in production. PostgreSQL uses one atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
against `app_private.rate_limit_buckets`, with HMAC-obscured composite subjects and timeouts. Policies
are distinct for public read, expensive search, goal evaluation, admin read/mutation,
authentication and promotion. The application ignores forwarded identity unless Vercel or an
explicit trusted-proxy contract is configured. Production still requires a restricted database role,
pool/load validation and edge abuse controls.

## RLS validation

A disposable PostgreSQL 16.13 cluster applied every append-only migration and tested real `anon`,
`authenticated`, forged metadata, valid admin and service contexts. The gate attempts another
user's rows, upsert/returning, candidate/admin access, unsafe views/functions and audit-log mutation.
It also seeds twice and verifies 3,043 projection parity. The new measurement/audit/rate tables do
not weaken canonical policies. Hosted Supabase was not modified or inspected.

## Evidence audit

The executable gate checked SQLite integrity/FKs and 240 assertion chains. There are zero orphan
fact/entity/relation sources, duplicate source identities, invalid assertion chains or duplicate
evidence links. Assertion confidence, evidence strength and source reliability are distinct
concepts. All 273 observed evidence source records are still marked unverified; structural integrity
must not be presented as independent gameplay verification.

## Measurement framework

The append-only migration adds review-separated measurements and observations. Accepted
measurements require a candidate assertion; measured observations require a value and evidence;
automatic canonical promotion is impossible. `GAMEPLAY_MEASUREMENT_PROTOCOL.md` defines repeatable
protocols for storage, sprinklers, recipe batches, automation throughput/range and residents without
inventing any value.

## Performance

Repeated microbenchmarks show no meaningful runtime regression: search median/p95 moved from
1.320/1.567 ms to 1.226/1.444 ms; graph traversal remains 0.005 ms median; goal evaluation remains
0.002 ms median. Forced build time rose from 6.18 to 6.78 seconds and forced tests from 6.32 to 7.52
seconds because new packages/tests execute. Web static JS/CSS grew 0.48%; admin static assets are
unchanged. See `audit-data/iteration-4-5/performance.json` for the method and byte counts.

## Tests

- 14/14 TypeScript workspace tasks and both production builds.
- 102 unit/integration tests across the tested workspaces.
- 50/50 Playwright cases across desktop Chromium and Pixel 7, including inert XSS payload,
  corruption recovery and keyboard/status accessibility.
- Dynamic PostgreSQL migrations, adversarial grants/RLS, rate-limit concurrency, idempotent seed and
  canonical parity.
- SQLite integrity/FK, evidence chain, environment, logging redaction, headers, malformed session,
  input bounds, graph/goal unknown behavior, dependency and source/bundle secret gates.

## Remaining unknowns

Forms and Lost Relics remain out of scope. Request, Treasure Map and Ditto Move versions and all
unmeasured capacity, quantity, throughput, radius/range and gameplay limits remain unknown. No
measurement value was fabricated or promoted.

## Remaining blockers

Before public production: individual admin identity/MFA/revocation; hosted Supabase migration plus
RLS/grant replay; production distributed-store credentials and trusted proxy validation; monitoring,
alerts and correlation; backup/restore and rollback rehearsal; preview load/cold-start/pool testing;
manual screen-reader/accessibility review; source reliability review; and an eligible managed Deep
Scan if that assurance is required.

## Production readiness

`PRODUCTION_READINESS.md` contains the PASS/CONDITIONAL/BLOCKED matrix. Local code, schema and
reproducibility gates support **CONDITIONAL GO**, but the unresolved operational controls prohibit a
public launch today.

## Recommendations for Iteration 5

Iteration 5 should begin with staging operations rather than new breadth: integrate individual Auth
and MFA, apply/replay migrations and RLS on an authorized staging project, provision rate limiting,
monitoring and backups, perform restore/load/accessibility drills, and execute measurement protocols.
Only then should product expansion be reconsidered.

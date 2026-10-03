# Pokopia Companion threat model

Date: 2026-08-11  
Scope: Iteration 4 baseline plus the local Iteration 4.5 hardening design.  
Non-scope: changing or asserting the state of hosted Supabase, Vercel, DNS or paid services.

## System and security invariants

The browser may request public canonical data and may own local-first progress. It must never obtain
database/service credentials, choose an administrator role, promote candidate evidence or authorize
itself. Next.js is the first trusted application boundary; PostgreSQL grants and RLS are a second,
independent boundary. Canonical gameplay claims must remain review-gated and traceable to evidence.
Failures in auth, rate limiting, environment validation or data parsing must not become implicit
authorization or invented gameplay truth.

## Assets

- Canonical game data, graph semantics, versions and review status.
- Evidence, assertions, sources, provenance links and measurement observations.
- Browser-local player progress, goals, favorites and future synchronized user state.
- Admin pages, future review/promotion mutations and the administrative audit trail.
- Admin authentication state, HMAC secrets, database URLs and future Supabase service credentials.
- SQLite artifacts, PostgreSQL/Supabase schema, migrations and seed inputs.
- Public/server APIs, ingestion/review tooling, build configuration, lockfile and release archive.

## Trust boundaries and data flows

| Boundary                          | Untrusted side                             | Trusted side                   | Required control                                                       |
| --------------------------------- | ------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------- |
| Browser -> public Next.js         | query, route, JSON, headers, local state   | server routes/components       | bounded schemas, escaping, cost limits, safe errors                    |
| Browser -> admin Next.js          | form, cookie, forwarded headers            | admin server/action/proxy      | authentication, server authorization, durable throttle, CSRF analysis  |
| Next.js -> database               | request-derived parameters                 | server-only repository         | parameterized SQL, least-privilege role, timeouts                      |
| Data API -> PostgreSQL            | anon/authenticated JWT claims              | grants + RLS                   | explicit grants, owner checks, trusted app metadata, role tests        |
| Server operations -> service role | runtime configuration                      | privileged database capability | server-only import/env boundary, redaction, no bundle/archive exposure |
| Corpus -> ingestion/SQLite        | HTML, manifests, paths, source text        | parser and generated artifacts | containment, size/shape limits, provenance, no raw HTML execution      |
| Local storage -> UI/goals         | corrupt, stale or future-version JSON      | progress model                 | strict normalization, backup/recovery, bounded collections             |
| Developer/CI -> release           | environment, dependencies, generated files | review ZIP                     | secret scan, clean staging, exact lockfile, reproducible gates         |
| Future sync -> user tables        | conflicting/offline writes                 | owned rows                     | stable IDs, idempotency, optimistic version, conflict policy           |

The local SQLite tooling and ingestion scripts are privileged local processes, not internet APIs.
That reduces reachability but does not make path traversal, unsafe overwrite or poisoned evidence
acceptable. CI/build output is also a boundary because browser bundling or archives can disclose a
secret even when runtime code does not.

## Threat actors

- Anonymous user, bot, scraper or remote attacker sending costly or malformed public requests.
- Authenticated malicious user attempting IDOR, row theft or privilege escalation.
- User forging client roles, proxy headers, cookies, JWT claims or local progress.
- Attacker abusing admin login, future review endpoints, replay or concurrency races.
- Compromised browser/client attempting to import server utilities or exfiltrate credentials.
- Malicious or corrupted source snapshot manipulating text, evidence, paths or volume.
- Accidental developer/operator error: unsafe grants, owner connection, leaked env, partial migration,
  non-idempotent seed or unreviewed candidate promotion.

## Applicable threats and planned controls

| Threat                                 | Applicability/evidence                                                              | Security invariant and control                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Authentication/session bypass          | admin uses a signed cookie; malformed, expired and forged tokens are reachable      | fixed format, bounded lifetime, strong secret, secure cookie and negative tests                     |
| Authorization/IDOR/escalation          | future user/admin tables are exposed through roles                                  | server checks plus grants/RLS; admin comes only from trusted identity/app metadata                  |
| Rate-limit bypass/exhaustion           | login, search and goals are remotely callable; baseline throttle is per process     | surface-specific policies, normalized composite keys and distributed atomic store                   |
| SQL injection                          | repositories use parameters; migration loops use internal allowlists                | prohibit request-derived identifiers and add source/test gates                                      |
| Command injection                      | no remote process execution found; local scripts use fixed commands/args            | keep CLI inputs separated and local-only                                                            |
| Path traversal                         | ingestion consumes manifest paths                                                   | canonical containment and symlink-aware regression fixtures                                         |
| XSS (stored/reflected/DOM)             | game/source text and search query are untrusted                                     | React text escaping, no `dangerouslySetInnerHTML`, payload tests and CSP                            |
| CSRF                                   | login is a cookie-creating server action; current admin has no mutation after login | SameSite Strict plus origin validation for cookie-authenticated mutations; reassess each new action |
| SSRF/open redirect                     | no user-controlled outbound fetch or redirect target found                          | keep redirects fixed/allowlisted; regression source scan                                            |
| Unsafe deserialization/mass assignment | JSON goals and imported local state are reachable                                   | byte/depth/count/type allowlists; construct accepted fields explicitly                              |
| Secrets/log/error leak                 | server env, DB errors and release artifacts are sensitive                           | `server-only`, env-name gate, structured redaction, fixed client errors and archive scan            |
| Cache poisoning/data leakage           | server components may be cached; user state is currently client/local               | never cache personalized/admin results publicly; explicit no-store where state is introduced        |
| Session fixation/theft/replay          | bearer-like HMAC cookie is replayable until expiry                                  | rotate on login, strict cookie, max lifetime, future individual revocation/MFA                      |
| Race/idempotency                       | rate counters, seeds, future promotion/sync can race                                | atomic database statement, unique constraints, transactions and replay tests                        |
| RLS/function/view bypass               | Supabase roles, views and helper functions are sensitive                            | real role queries, invoker views/functions, fixed search path, narrow EXECUTE grants                |
| Service-role leakage                   | future key bypasses RLS                                                             | server-only variable, no `NEXT_PUBLIC` alias, bundle/archive/log gate                               |
| Evidence corruption                    | candidate assertions can be mistaken for canonical truth                            | lifecycle gates, non-dangling chain, conflict state and manual review                               |
| Dependency/build compromise            | npm install and build execute third-party code                                      | exact lockfile, audit, minimal additions, clean-room restore                                        |

## Non-applicable or currently constrained paths

There is no upload handler, arbitrary URL fetcher, Markdown/HTML renderer, public database mutation,
admin review mutation, RPC endpoint or cloud-sync endpoint in the current runtime. SSRF, unrestricted
upload, stored-XSS persistence through the app and CSRF against a privileged mutation therefore have
no demonstrated source-to-sink path today. They remain design checks for future endpoints rather than
inflated current findings.

## Abuse cases to prove

1. Forged/expired/malformed sessions and client role headers never open admin pages or actions.
2. Multiple simulated instances share an atomic distributed limit; spoofed IP headers cannot select
   a privileged identity and store failure fails closed for auth/admin.
3. `anon` cannot write, `authenticated` cannot read/write another user's rows, and non-admin users
   cannot access admin/provenance candidates through joins, views, functions, upsert or `RETURNING`.
4. Very large, deeply nested, Unicode and ambiguous inputs remain bounded and cannot render markup.
5. Corrupt/future local progress is preserved for recovery and cannot manufacture confirmed state.
6. Graph cycles, self-edges, duplicates, direction conflicts and unknown evidence do not produce a
   confident recommendation.
7. Service credentials cannot appear in client code, public env names, logs, fixtures or the ZIP.

## Residual risk and acceptance

Local tests can prove code and schema behavior, not hosted configuration, monitoring, backups, TLS,
proxy semantics or identity-provider setup. Until those controls are configured and rehearsed, the
maximum honest release verdict is `CONDITIONAL GO` even if all local gates pass. A critical/high
authorization bypass, secret exposure, non-atomic production limiter or failing RLS test makes the
verdict `NO-GO`.

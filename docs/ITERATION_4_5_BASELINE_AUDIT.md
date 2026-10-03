# Iteration 4.5 baseline audit

Date: 2026-08-11  
Baseline artifact: `Pokopia-Companion-Iteration-4-REVIEW.zip`  
Expected and observed SHA-256:
`d9cf1b6be84049b1a287165831fcbf00a6ccf7563375896ab9bae653fa2d9d98`

## Independent restoration

The archive was tested with `unzip -tq`, extracted below a new `/tmp` directory and evaluated without
using the working tree's dependencies or build outputs. It contains one intentional top-level
directory. The first restore command was run one directory too high and therefore could not find the
lockfile; the corrected command entered that directory and passed. This operational mistake did not
change the archive or repository.

| Check                                  | Baseline result | Evidence                                                   |
| -------------------------------------- | --------------- | ---------------------------------------------------------- |
| SHA-256                                | PASS            | observed digest equals the adjacent checksum file          |
| ZIP integrity                          | PASS            | `unzip -tq`: no compressed-data errors                     |
| suspicious symlinks                    | PASS            | no symlink entries after extraction                        |
| dependencies/builds/caches/private env | PASS            | none found; `.env.example` is the documented template      |
| reproducible install                   | PASS            | `npm ci`, 479 packages from the exact lockfile             |
| format                                 | PASS            | Prettier matched all files                                 |
| lint                                   | PASS            | ESLint with zero warnings                                  |
| TypeScript                             | PASS            | 13/13 workspace tasks                                      |
| unit/integration tests                 | PASS            | 17/17 Turbo tasks                                          |
| production builds                      | PASS            | web and admin compiled with Next.js 16.3.0                 |
| desktop/mobile E2E                     | PASS            | 44/44 baseline tests in desktop Chromium and Pixel 7       |
| SQLite integrity/FK                    | PASS            | compact review SQLite is intact with no FK violations      |
| PostgreSQL dynamic gate                | FAIL            | clean archive points only to an excluded full canonical DB |

The install reports the known transitive deprecation of `whatwg-encoding@3.1.1`. This is not, by
itself, a vulnerability result. Production dependency risk is evaluated separately with `npm audit
--omit=dev` during the final gate.

## Real baseline state

The review archive is a coherent local-first product, not a hosted production system. Public game
data is read server-side from a compact source-derived SQLite database; PostgreSQL is the normalized
target model. Player progress remains in browser storage and `/api/goals` evaluates supplied state
without persisting it. The admin application is read-only today and uses a shared-password,
HMAC-cookie fallback. Hosted Supabase and Vercel state are outside this audit and were not changed.

Iteration 4 already includes bounded JSON reading, bounded fuzzy-search work, a process-local login
throttle, minimal public health output and path-containment checks in ingestion. Those controls are
real, but some are deliberately local-development controls rather than multi-instance production
controls.

## Discrepancies and demonstrable debt

1. The login throttle is a global in-memory map. Concurrent serverless instances do not share it.
2. Client identity uses `x-forwarded-for` without an explicit trusted-proxy contract or canonical IP
   handling.
3. The admin fallback has no individual identity, MFA, revocation list or durable audit actor. A
   shared password must not be described as complete production authentication.
4. Security headers are not defined explicitly in either Next.js application.
5. Invalid local progress silently becomes empty state. The application avoids execution on corrupt
   data, but does not preserve a recoverable copy or visibly distinguish corruption from no progress.
6. PostgreSQL policy tests prove many invariants, but the baseline dynamic gate does not yet exercise
   the requested cross-role joins, returning clauses, upserts and view/function bypass attempts.
7. The evidence artifacts document provenance, but Iteration 4.5 still needs a single executable
   integrity gate spanning canonical record, assertion, evidence and source.
8. No production monitoring, backup, rollback rehearsal, hosted Auth validation or distributed store
   is configured. These are operational blockers, not facts that local tests can manufacture.
9. Codex Security's managed Deep Scan could not start because this desktop task has no managed
   filesystem permission profile. The local audit therefore records its manual coverage and does not
   claim a sealed Deep Scan report.
10. The baseline PostgreSQL gate is not clean-archive reproducible: `test-postgres.mjs` hard-codes
    `data/canonical/v3.1/pokopia-canonical.sqlite`, which the REVIEW package intentionally excludes,
    instead of accepting its included `audit-data/pokopia-review.sqlite`. The E2E suite itself passes
    44/44. Iteration 4.5 corrects the resolver and must prove it from the final clean package.

## Attack surface and priorities

The reachable mutation surface is currently small: login creates a cookie and the goals route only
evaluates request data. The highest-risk boundaries are nevertheless the admin credential/session,
future PostgreSQL role configuration, attacker-controlled search/goal inputs, corpus-derived text,
local progress imports, ingestion paths and release artifacts.

Remediation order is: authorization correctness; distributed abuse controls; RLS/grant execution
tests; server/client and secret gates; input/state recovery; evidence integrity; observability and
headers; performance/accessibility regression; clean-package proof.

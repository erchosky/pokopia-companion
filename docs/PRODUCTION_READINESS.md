# Production readiness v2

Date: 2026-08-11. `PASS` means the named evidence was executed; it never propagates from local to
hosted. `BLOCKED` means the target or provider prerequisite was unavailable, not that a test passed.

| Control                   | Local assurance                                                             | Hosted staging assurance                               | Production operational requirement                                   |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Master corpus             | PASS: 2,532 RAW pages, archive/index/SQLite hashes and every RAW hash       | N/A: corpus intentionally not deployed                 | two failure-domain source backups plus periodic restore verification |
| Clean reproducibility     | PASS: baseline and current source gates; compact audit fallback             | BLOCKED: no deployment                                 | restore exact release artifact before promotion                      |
| Individual admin identity | PASS: server allowlist and provider-user verification code/tests            | BLOCKED: Supabase reauthentication required            | separate named accounts; no shared fallback                          |
| MFA                       | PASS locally for deny/allow `aal` boundary tests                            | BLOCKED: no enrolled staging user                      | TOTP/WebAuthn enrollment, recovery and real AAL2 replay              |
| Revocation                | PASS: deleted/banned provider response denies                               | BLOCKED: real login-revoke-replay not run              | measured revocation delay and operator runbook                       |
| RLS/grants                | PASS: PostgreSQL 16.13 adversarial role matrix                              | BLOCKED: no authorized hosted database                 | replay after every migration with real tokens/advisors               |
| Distributed limiter       | PASS: atomic PostgreSQL concurrency; memory rejected hosted                 | BLOCKED: no staging DSN or multi-instance replay       | restricted role, pool/load evidence, edge abuse controls             |
| Trusted proxy             | PASS: parsing/spoofing unit cases; explicit opt-in                          | BLOCKED: no deployed request path                      | verify platform overwrite and upstream topology                      |
| HTTPS/cookies             | PASS: Secure/HttpOnly/SameSite Strict hosted cookies and HSTS config        | BLOCKED: no HTTPS response captured                    | certificate/redirect/header inspection on final domain               |
| Cache/CDN                 | PASS: admin private no-store; API no-store; Vary on auth                    | BLOCKED: no CDN replay                                 | prove no personalized/admin response in public cache                 |
| CORS/origin               | PASS: exact same-origin server boundary                                     | BLOCKED: no hosted origins                             | explicit allowlist and negative cross-origin replay                  |
| Headers                   | PASS: CSP, frame denial, nosniff, referrer, permissions, COOP, HSTS         | BLOCKED: no hosted capture                             | inspect browser/CDN response; nonce CSP remains future hardening     |
| Logs/redaction            | PASS: structured redaction tests                                            | BLOCKED: no durable sink                               | retention/access policy, correlation and alert routing               |
| Load/cold starts/pooling  | PASS only for local microbenchmarks/timeouts                                | BLOCKED: no hosted topology                            | bounded load, warm/cold percentiles and pool saturation evidence     |
| Monitoring/SLOs           | CONDITIONAL: proposed signals and request IDs                               | BLOCKED: no project/sink                               | live checks, dashboards, actionable alerts and ownership             |
| Database backup/restore   | CONDITIONAL: strategy documented                                            | BLOCKED: no provider backup                            | successful safe restore drill with measured RPO/RTO                  |
| Application rollback      | CONDITIONAL: immutable release approach documented                          | BLOCKED: no prior deployment                           | deploy/rollback rehearsal plus forward DB correction policy          |
| Accessibility             | PASS for automated desktop/mobile flows                                     | BLOCKED: no hosted manual VoiceOver/zoom/contrast pass | manual assistive-technology report on final staging                  |
| Evidence quality          | PASS: 240 structurally valid chains, zero orphans                           | CONDITIONAL: 273 source records still unverified       | prioritize P0/P1 review; never auto-promote                          |
| Dependency security       | PASS: exact lockfile and zero known production vulnerabilities at gate time | N/A                                                    | continuous advisory monitoring                                       |
| Managed Deep Scan         | BLOCKED by desktop permission profile                                       | BLOCKED                                                | rerun in an eligible managed-security task if required               |

## Release decision

**CONDITIONAL GO.** The code and data-preservation controls are suitable for creating a controlled
staging environment. They are not approval for public production traffic. GO FOR PRODUCTION requires
real hosted evidence for identity/MFA/revocation, RLS/grants, distributed limiting, proxy, HTTPS,
cache, load/pooling/cold starts, monitoring, backup/restore, rollback and manual accessibility.

Any Critical/High authorization bypass, secret exposure, failing RLS boundary, non-atomic protected
limiter or failed restore changes the decision to `NO-GO` until corrected and replayed.

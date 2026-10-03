# Iteration 4.6 baseline audit

Date: 2026-08-11  
Authoritative input: `Pokopia-Companion-Iteration-4.5-REVIEW.zip`

## Identity and clean-room result

| Check               | Result | Evidence                                                                                      |
| ------------------- | ------ | --------------------------------------------------------------------------------------------- |
| SHA-256             | PASS   | `007c284f0dff410b93c64883086bbf0f19c666862d1d7e00ee9b0e18ee45d060`                            |
| Archive bytes       | PASS   | 8,814,728                                                                                     |
| ZIP integrity       | PASS   | every member tested from a fresh temporary extraction                                         |
| Dependencies        | PASS   | `npm ci`, 480 packages                                                                        |
| Format / ESLint     | PASS   | Prettier check and ESLint with zero warnings                                                  |
| TypeScript          | PASS   | 14/14 workspace tasks                                                                         |
| Unit/integration    | PASS   | 19 tasks, 102 tests                                                                           |
| Builds              | PASS   | web and admin production builds                                                               |
| Security regression | PASS   | 154 source files scanned                                                                      |
| E2E                 | PASS   | 50/50 Chromium desktop and Pixel 7                                                            |
| SQLite REVIEW       | PASS   | integrity `ok`; 2,078 pages and 2,078 entities                                                |
| Evidence integrity  | PASS   | 240 assertion chains; zero integrity/FK/orphan failures                                       |
| PostgreSQL          | PASS   | PostgreSQL 16.13 migrations, RLS/grants, atomic limiter, idempotent seed and 3,043-row parity |
| Dependency audit    | PASS   | zero known production vulnerabilities                                                         |

The baseline was tested from a clean extraction, not inferred from the previous report. No production
or hosted database was contacted during these gates.

## Baseline discrepancy reproduced

`npm run audit:review-data` fails inside the clean 4.5 package because the generator hard-codes
`data/canonical/v3.1/pokopia-canonical.sqlite`, which the compact REVIEW archive intentionally
excludes. This is PK46-001. Iteration 4.6 changes the command into a dual-mode gate: regenerate when
the full canonical store is available, otherwise verify the included compact audit and its declared
hash, integrity, foreign keys and row counts.

## Starting verdict

**CONDITIONAL GO.** The restored local baseline is healthy and has no known Critical or High finding.
It does not prove hosted identity, MFA, revocation, provider RLS/grants, real distributed limiting,
monitoring, backup/restore, rollback, CDN/cache behavior, load, cold starts or manual accessibility.
Those items remain separate hosted gates and cannot inherit local PASS status.

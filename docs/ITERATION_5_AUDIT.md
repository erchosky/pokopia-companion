# Iteration 5 — baseline audit

Date: 2026-08-11. Audited baseline: `Pokopia-Companion-Iteration-4.6-REVIEW.zip`.

## Provenance gate

- Expected SHA-256: `70a65d05855f7a82daa61d03cd54026d0444d0921f81d703ca206b151425c4c5`.
- Actual SHA-256: exact match.
- Sidecar checksum: PASS.
- ZIP structural integrity: PASS.

The immutable source snapshot remains the only corpus used. No scrape, hosted mutation or automatic
evidence promotion is part of Iteration 5.

## Current domain inventory

| Area                     |            Observed baseline | Iteration 5 consequence                                      |
| ------------------------ | ---------------------------: | ------------------------------------------------------------ |
| recipes                  |                          882 | preserve every identity and audit all records                |
| recipe ingredients       |                        1,333 | two quantities remain unknown                                |
| recipe output quantities | 882 `derived_default` values | treat as unknown, never as evidence-backed `1`               |
| automation systems       |                           11 | keep structural coverage separate from completeness          |
| player inventory         |            boolean ownership | migrate `true` to owned + quantity unknown, never quantity 1 |

## Findings before implementation

### P0 — invented recipe output arithmetic

`RecipeSummary.outputQuantity` is always `1` with status `derived_default`. The V1 crafting planner
then applies `Math.max(1, outputQuantity)`, which turns missing evidence into exact batch arithmetic.
This is unsafe for “craft N” and recursive totals. Iteration 5 must make the quantity nullable and
surface the missing batch size.

### P0 — absence in player state treated as missing

Automation V2 accepts only a list of owned item slugs. Any item absent from that list is classified
as missing even though My Pokopia defines absence as unknown. Iteration 5 must evaluate explicit
`yes`, `no` and `unknown` states.

### P0 — build and operational readiness are conflated

The existing automation plan has one `canBuild` result. It cannot distinguish enough construction
materials from power, infrastructure, operational inputs, roles or compatibility. Iteration 5 must
return independent build and operational evaluations with traces.

### P1 — recipe alternatives are silently selected

The V1 recipe index is a `Map` keyed by output slug. If more than one recipe exists, the last record
wins. Iteration 5 must retain alternatives and require an explicit choice.

### P1 — recursive plan has no inventory allocation or surplus

V1 multiplies branches independently. It cannot consume confirmed inventory, distinguish quantity
unknown from zero, reuse shared intermediate surplus, or explain which dependency created a total.

### P1 — rule provenance is implicit

Requirement and town-level helpers do not expose a uniform rule identity, version, subject,
predicate/effect, content scope and evidence contract. Iteration 5 needs a typed rule registry and
structured evaluation trace.

### P1 — simulation contract is absent

There is no immutable “what if” snapshot or action result. Recommendations therefore cannot prove
that evaluation and simulation share the same rules.

### P2 — UI exposes the old assumptions

The recipe page explicitly says it assumes one output per craft, and Automation Planner V2 shows
only a coarse readiness strip. Both must be replaced with evidence-aware states and expandable
“why / why not / why unknown” traces.

## Architectural decision

Evolve `@pokopia/rules`, `@pokopia/intelligence`, the repository types and My Pokopia in place. Keep
the dependency direction and the boundary:

`evidence -> facts -> rules -> player state -> evaluation -> simulation -> recommendation`

Unknown values remain data. They are not converted to zero, false, one, an empty requirement or a
favorable recommendation.

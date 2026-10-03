# Game Rule Engine V1

## Boundary

The deterministic engine lives in `@pokopia/rules`. It consumes source-backed domain records and
explicit player state; it does not read localStorage, Next.js, SQLite or PostgreSQL.

`evidence -> facts -> rules -> player state -> evaluation -> simulation -> recommendation`

Data, rules, player state and plans remain different objects. A recommendation never becomes a
canonical fact.

## Rule contract

Every `GameRule` has a stable ID and numeric version, subject, family, predicates, effects,
provenance/evidence, confidence, content scope, game version, enabled state and deprecation state.
Families are requirement, transformation, availability, compatibility, progression and measurement.

`rulesFromRecipes` creates one transformation rule per recipe. `rulesFromAutomation` creates
independent build and operation rules per system. The real corpus produces 904 rules: 882 recipe
transformations and 22 automation rules.

## Three-valued semantics

- Missing player state is `unknown`, never `no`.
- Confirmed inventory zero can produce `no`.
- Missing negative compatibility evidence remains `unknown`.
- A derived-default output quantity remains `unknown` even when its transport value is `1`.
- Unaccepted measurements never enter calculations.

Every result has an `EvaluationTrace` with rule ID/version, result, reason, bounded inputs, evidence
and children. Unknown content scope is never silently classified as base game.

## Safety invariants

- Quantities are safe positive integers capped at 1,000,000,000.
- Cycles throw `CraftingCycleError` with their path.
- Multiple recipes require an explicit choice.
- Simulation clones snapshots and never mutates the input.
- Throughput is unavailable without an accepted measurement.

Evidence: `audit-data/iteration-5/rule-coverage.json`, `trace-samples.json` and
`adversarial-cases.json`.

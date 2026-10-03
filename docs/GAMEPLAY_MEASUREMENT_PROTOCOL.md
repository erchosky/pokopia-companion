# Gameplay measurement protocol

Iteration 4.5 defines how manual observations can become reviewable evidence. It does not populate
any gameplay value. Unknown stays unknown until a protocol is executed, recorded and reviewed.

## Data lifecycle

`measurement -> observation -> evidence -> candidate assertion -> manual review -> canonical`

Measurements are stored separately from canonical facts. States are `proposed`, `measured`,
`replicated`, `disputed`, `accepted` and `superseded`. An observation is `measured`, `unknown`,
`error` or `excluded`. PostgreSQL enforces that a measured observation has a numeric value and an
evidence reference, an error has a reason, and an accepted measurement references a candidate
assertion. There is no automatic canonical promotion.

Each run records metric identity, exact game version/content pack, setup, conditions, independent
variables, repetition, unit, value, uncertainty, tester reference, timestamp, attachment/source
reference, notes through structured setup/conditions, and verification state. Use one idempotency key
per experimental series.

## General acceptance rules

- Record the game version shown by the tested build; never infer it from the calendar.
- Change one independent variable at a time or describe the factorial design explicitly.
- Preserve screenshots/video or timestamped raw notes for every measured repetition.
- Record failed and unknown runs; do not delete inconvenient values.
- Use at least three repetitions for deterministic capacities/radii and at least ten timed windows
  for throughput unless the protocol below is stricter.
- A second tester or independent save should replicate material claims before `replicated`.
- Disagreement beyond the stated uncertainty becomes `disputed`, not an average hiding the conflict.
- Acceptance is a review decision. The mean, median or range is descriptive evidence, not automatic
  truth.

## Storage capacity

1. Preparation: empty the target container; record item/container variant, town, upgrades and game
   version; capture the empty UI.
2. Independent variable: container type/variant. Do not change upgrades during a series.
3. Dependent variable: maximum accepted item count or occupied slots, with stacking rules stated.
4. Controls: use one repeatable item and known stack size; keep player inventory and multiplayer
   state constant.
5. Procedure: add one full stack at a time, then single items near the limit; record the first
   rejected insertion and UI count.
6. Repetitions: three resets per container; repeat with a second item only if stack behavior differs.
7. Expected evidence: before/after screenshots and continuous video around the rejection boundary.
8. Unknown/error: record inaccessible UI, upgrade ambiguity or inconsistent stacks as unknown/error.
9. Acceptance: all repetitions agree exactly, or a documented stacking rule explains differences;
   independent replication is required for canonical capacity.

## Sprinkler radius

1. Preparation: flat unobstructed grid, one sprinkler, identical dry plots and exact orientation.
2. Independent variable: integer tile offset and sprinkler variant.
3. Dependent variable: watered/not-watered state after one activation.
4. Controls: weather off/known, no Pokémon watering, identical terrain/elevation and time window.
5. Procedure: mark coordinates, activate once, inspect every tile in a square exceeding the expected
   range and record a binary matrix.
6. Repetitions: five rotations/resets; include boundary and diagonal tiles.
7. Expected evidence: coordinate diagram plus screenshots/video of the complete matrix.
8. Unknown/error: ambiguous wet texture, rain or another watering source invalidates that repetition.
9. Acceptance: identical boundary in all valid runs; report shape and offsets, not only one radius.

## Recipe yield and batch size

1. Preparation: empty output inventory, exact station/recipe/version and enough measured inputs.
2. Independent variable: requested batch count.
3. Dependent variable: consumed ingredients and produced units.
4. Controls: buffs, Pokémon skills, upgrades and overflow destinations disabled or recorded.
5. Procedure: craft batches of 1, 2 and 5; record before/after inventory and overflow.
6. Repetitions: three of each batch size.
7. Expected evidence: recipe screen plus inventory deltas for every run.
8. Unknown/error: output routed elsewhere or untracked passive production invalidates the run.
9. Acceptance: output and input scale consistently or a deterministic rounding/batch rule is shown.

## Automation throughput

1. Preparation: isolated system at steady state, known input buffer, empty measured output and exact
   components/version.
2. Independent variable: system configuration; test one configuration per series.
3. Dependent variable: valid output units per real minute and in-game cycle.
4. Controls: input availability, power, worker Pokémon, range, game speed, foreground/background
   state and collection behavior.
5. Procedure: warm up for two cycles, then measure at least ten equal windows; log start/end counts
   and interruptions.
6. Repetitions: ten windows in two sessions; another tester/save for replication.
7. Expected evidence: timer-visible video or synchronized timestamps and inventory screenshots.
8. Unknown/error: starvation, sleep/background pause or overflow is tagged and excluded with reason.
9. Acceptance: report median, range and configuration; accept only if valid windows are stable within
   a preregistered tolerance such as 5%, otherwise remain disputed. The tolerance may be changed only
   before measurement.

## Automation range

1. Preparation: open coordinate grid, one machine/source and identical targets at measured offsets.
2. Independent variable: axial/diagonal offset, elevation and obstruction as separate series.
3. Dependent variable: connection/activation observed within a fixed test window.
4. Controls: same components, power, target type, orientation and version.
5. Procedure: expand outward one tile at a time, test all cardinal directions, then diagonals,
   elevation and obstacles separately.
6. Repetitions: three full boundary sweeps per condition.
7. Expected evidence: coordinate map and video of last working/first failing offsets.
8. Unknown/error: intermittent activation or unverified coordinate scale stays unknown.
9. Acceptance: report a shape/condition table; do not collapse asymmetric behavior into one radius.

## Resident limits

1. Preparation: record town, level, facilities, residents and expansion/version state.
2. Independent variable: town level or explicitly identified capacity upgrade.
3. Dependent variable: maximum accepted resident count and rejection message.
4. Controls: no resident moves between attempts; keep housing/facilities constant within each series.
5. Procedure: add residents individually until rejected, capture count/message, remove one and retry.
6. Repetitions: three fill/remove/refill cycles per level.
7. Expected evidence: roster before/after and rejection UI.
8. Unknown/error: hidden quest prerequisites or transient unavailable residents are recorded, not
   interpreted as capacity.
9. Acceptance: exact boundary and reversible one-slot check agree in all runs.

## Other priority unknowns

The same template applies to watering duration, production cycle time, power capacity, transport
latency and effect duration. Each requires a named unit, observable boundary, controlled confounders,
raw evidence and explicit review. The current corpus's unverified source status is not replaced by a
measurement proposal.

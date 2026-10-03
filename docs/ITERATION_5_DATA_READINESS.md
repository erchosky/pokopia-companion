# Iteration 5 data readiness

Iteration 5 may build only on explicit evidence. The current architecture already keeps
`data != rules != player state != planner`; this document does not implement any engine.

| Concept                       | Known?          | Source                                  | Canonical?                             | Measurement needed?      | Blocking 5.0?              |
| ----------------------------- | --------------- | --------------------------------------- | -------------------------------------- | ------------------------ | -------------------------- |
| machine identity              | partial         | item/automation pages                   | partial typed projection               | no for listed machines   | no                         |
| machine inputs                | partial         | source statements                       | some assertions, often derived         | yes when quantity absent | yes for simulation         |
| machine outputs               | partial         | source statements/recipes               | partial                                | yes when quantity absent | yes for simulation         |
| production recipes            | partial         | 882 recipe projection                   | identity/ingredients largely canonical | validate coverage        | yes for complete engine    |
| recipe quantity               | incomplete      | table cells                             | partial; two known unknowns remain     | yes                      | yes                        |
| recipe duration               | unknown         | not reliably present                    | no                                     | yes                      | yes                        |
| throughput                    | unknown         | current corpus does not establish rates | no                                     | yes                      | yes                        |
| storage capacity              | unknown         | descriptions only                       | no                                     | yes                      | yes for inventory planning |
| range / automation radius     | unknown         | current corpus insufficient             | no                                     | yes                      | yes for layouts            |
| energy/resource consumption   | unknown/partial | recipe/input text                       | not complete                           | yes                      | yes                        |
| prerequisites                 | partial         | requirements/unlocks                    | partial typed relationships            | review P0                | yes                        |
| unlocks                       | partial         | progression/item pages                  | partial typed relationships            | review P0                | yes                        |
| Pokémon automation capability | partial         | specialty/capability evidence           | medium/low derived assertions          | gameplay verification    | yes for assignment rules   |
| town restrictions             | partial         | location/unlock inference               | low-confidence derived links           | verify/measure           | yes for location rules     |

## Safe scope after 4.6

Canonical identities, entity relationships, provenance contracts, versioning, local player-state
boundaries and explainable derived outputs are sufficient to design interfaces and import reviewed
rules. They are not sufficient for truthful duration, throughput, capacity, range, resource cost or
complete compatibility simulation. Those values are `measurement-required`, `unknown`, or
`unsupported by current corpus`, never zeros/defaults.

The first Iteration 5 gate should ingest P0 evidence decisions and measurement outputs into typed,
versioned candidates. A rule engine, simulation engine or planner must not silently fall back from an
unknown value to a plausible constant.

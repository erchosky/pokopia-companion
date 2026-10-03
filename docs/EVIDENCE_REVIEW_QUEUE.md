# Evidence review queue

The current audit has 240 assertion chains and 273 unverified evidence-source records. Structural
integrity is PASS; source reliability is not. No assertion is auto-promoted by this queue.

| Priority | Scope                                                | Why first                                      | Exit evidence                                                    |
| -------: | ---------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
|       P0 | progression, prerequisites and unlocks               | wrong ordering corrupts goals and next actions | source excerpt plus independent official or in-game reproduction |
|       P0 | Base/DLC classification                              | changes availability and version filtering     | versioned official source or reproducible ownership test         |
|       P1 | Goal Engine and Next Actions dependencies            | user-facing advice depends on them             | complete chain with negative/edge case                           |
|       P1 | automation inputs, outputs, recipes and capabilities | blocks Iteration 5 correctness                 | typed quantities/units and repeatable evidence                   |
|       P2 | storage, duration, capacity, range and throughput    | requires measurement rather than inference     | protocol, sample size, game version and raw observations         |
|       P3 | encyclopedic aliases and low-impact descriptions     | low decision impact                            | second-source review                                             |

Reviewers must preserve the source URL, snapshot, exact locator, game/DLC/version, confidence and
verification actor/time. Conflicts stay open and measurements stay candidates until a separate human
decision. The machine-readable queue is `audit-data/iteration-4-6/evidence-review-queue.json`.

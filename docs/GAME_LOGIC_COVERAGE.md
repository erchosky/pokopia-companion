# Game logic coverage — Iteration 5.1

Generated from canonical SQLite with `npm run audit:iteration-5`.

| Domain               | Structural coverage |      Quantitative coverage | Principal blockers                            |
| -------------------- | ------------------: | -------------------------: | --------------------------------------------- |
| recipes              |             882/882 | 0/882 exact output batches | 882 measured yields; 2 ingredient quantities  |
| recipe graph         |         1,333 edges |   partial per-craft inputs | output batch evidence                         |
| automation           |          15 systems |    13 with known parameter | throughput, storage, compatibility            |
| original automation  |          11 systems |                       9/11 | Floor Switch and Portal Pod remain structural |
| production chains    |    14/15 structural |    partial, evidence-gated | recipe yields and operational cycles          |
| rule registry        |           904 rules |                        N/A | version scope largely unknown                 |
| My Pokopia inventory |           V5 schema |  user-confirmed quantities | local data completeness                       |

## P0 evidence queue

1. Measure recipe batches by high-impact/template families without generalizing samples.
2. Measure automation throughput/duration and Furnace consumption with replicated windows.
3. Measure storage and controlled town compatibility without manufacturing negatives.

Iteration 5.1 recovered 115 evidence records for 114 unique quantitative facts and removed the
derived output default. Full evidence is generated with `npm run audit:iteration-5-1`.

Reference cases cover Portal Pod ×20, Automatic Doors, Pokémetal, a shared intermediate, unknown
electricity and unknown version/DLC.

## Performance

Node 22.23.1, canonical SQLite: crafting median 0.022 ms/p95 0.059 ms (1,000 repetitions), automation
median 0.002 ms/p95 0.003 ms (5,000 repetitions). These are local microbenchmarks, not hosted
latency. Full evidence: `audit-data/iteration-5/performance.json`.

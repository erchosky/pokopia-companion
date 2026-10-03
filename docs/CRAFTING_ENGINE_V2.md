# Crafting Engine V2

`calculateCraftPlan` returns requested output, craft count when knowable, direct and recursive
materials, intermediates, confirmed inventory use, missing/unknown inventory, known surplus,
unknown quantities, alternatives and a structured trace. `buildCraftGraph` also creates the inverse
“which recipes consume this item?” index.

## Quantity semantics

The 882 projected recipes contain a legacy transport value of output `1` with status
`derived_default`. V2 quarantines that value: it is not a known batch size. One requested copy can
expose a structural one-craft path, but surplus stays unknown. For more than one copy, craft count and
multiplied totals remain unknown until batch evidence is accepted. Two ingredient quantities also
remain unknown. No `Math.max(1, unknown)` fallback exists.

Inventory distinguishes confirmed zero, positive quantity and unknown quantity. The planner consumes
a cloned ledger, uses confirmed inventory before crafting dependencies and carries known surplus so
shared branches can reuse it.

Recipes are indexed as arrays. If several produce one output and no explicit selection exists,
status is `choice_required`; V2 never picks first, last or cheapest. Cycles stop with their path.

## Real coverage

- 882/882 structural recipe graphs.
- 1,333 ingredient edges.
- 0/882 evidence-backed output batches.
- 2 unknown ingredient quantities.
- Exact quantitative multi-copy coverage: 0 until accepted batch measurements exist.

See `audit-data/iteration-5/crafting-coverage.json` and `recursive-coverage.json`.

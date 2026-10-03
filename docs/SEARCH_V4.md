# Search V4

Search V4 retains structured-first ranking and FTS fallback, and adds typed results for Requests,
Treasure Maps, Music CDs and Ditto Moves. Results route to real entity pages rather than a generic
source search.

## Direct answers

- Treasure Map 6 / Quick Ball → the map detail, including its source-quality warning.
- CD + DLC/expansion → the verified Expansion Pass CD filter.
- learn Water Gun → the Ditto Move detail.

## Safety budget

Public fuzzy search normalizes at most 120 Unicode characters, 12 tokens and 20 variants. These caps
are applied in the engine, not only the HTML input, so direct requests cannot bypass them. Edit
distance remains typo-tolerant inside that bounded budget.

## Regression contract

`audit-data/iteration-4/search-v4-cases.json` records representative queries. Unit tests also run
the mandatory V3.5 regressions against the real canonical database so the new kinds cannot displace
Portal Pod, Spanish synonym or storage-size behavior.

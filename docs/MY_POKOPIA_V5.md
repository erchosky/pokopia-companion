# My Pokopia V5

Each inventory item records ownership (`owned`, `not_owned`, `unknown`), quantity state
(`confirmed`, `unknown`), a non-negative safe integer or `null`, and an update timestamp. Quantity
unknown, confirmed zero and positive quantity are distinct.

## V4 migration

- `item:* confirmed true` -> owned + quantity unknown + `null`, never one.
- `item:* confirmed false` -> not owned + confirmed zero.
- Absent items remain unknown.
- Goals, towns, residents, recents, favorites and inference provenance are preserved.

The key is `pokopia-progress-v5`; V4/V3/V2/V1 remain migration fallbacks. Repair/migration preserves
the original snapshot as a downloadable recovery backup.

Town infrastructure is stored per town as confirmed, missing or unknown. Built systems remain
explicit confirmed progress entries and feed operational readiness. The dashboard shows inventory,
Built system and infrastructure coverage.

Validation caps collections/text, rejects negative/fractional/oversized quantities, strips unsupported
fields, repairs partial state and rejects future versions. V5 remains local-first and is never mixed
with canonical game data. Goal evaluation receives only a bounded ephemeral projection.

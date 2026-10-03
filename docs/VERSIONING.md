# Game and Knowledge Versioning

## Iteration 4 content classification

New progression projections expose `base_game`, `expansion` or `unknown` independently from their
review status (`verified`, `candidate`, `unknown`). Music CDs 1–43 are verified base-game rows and
100–109 are verified Expansion Pass rows. Requests, Treasure Maps and Ditto Moves stay unknown.
“All” includes unknown; filters never reinterpret absence as base game.

## Iteration 3.5: null no significa una sola cosa

Una versión nula debe declararse como `unknown` o `unversioned_system`; no se interpreta automáticamente. `specific` exige una versión introducida real. Las reglas de sistema de la aplicación pueden ser `unversioned_system`, pero las assertions gameplay sin versión permanecen `unknown`.

## Semantics

Each game version has a provider-neutral label plus a monotonically increasing `ordinal`. The label is for display; the ordinal is for comparison. Validity intervals are half-open:

```text
[introduced_version, removed_version)
```

A record introduced in v2.0 and removed in v2.2 is visible at v2.0 and v2.1, but not v2.2. A null start means “known before our version coverage”; a null end means “still effective or removal unknown.” A fabricated baseline version is therefore not mandatory. Nullable introduction keys remain genuinely nullable: versioned associations use surrogate primary keys plus PostgreSQL 15 `UNIQUE NULLS NOT DISTINCT`, preventing duplicate unknown-baseline rows without coercing null into a false game version.

## What is versioned

- Entity existence: `entities.introduced_version_id` / `removed_version_id`.
- Version-sensitive relationships: Pokémon roles, abilities, habitats, locations, item sources, unlocks, prerequisites, and other joins.
- Knowledge: assertions carry introduced, removed, and verified game versions.
- Derived data: score observations carry game version, scoring-model version, preset, and input hash.
- Source observations: every document belongs to an immutable source snapshot.

Names and alternative spellings are retained as aliases rather than destructive renames.

## Update algorithm

1. Create an immutable `source_snapshot` with a content hash.
2. Compare its documents/natural keys/hashes to the previous snapshot.
3. Record added, removed, modified, unchanged, and conflicting entries in `snapshot_diffs`.
4. Insert candidates into `staging_records`; never mutate canonical rows directly.
5. Resolve identity and compare candidate assertions with effective accepted assertions.
6. For a real change, set the previous assertion's removal version/lifecycle and insert a new assertion with `supersedes_assertion_id`.
7. Attach evidence and review/verification records.
8. Promote only accepted facts, then rebuild affected search and score projections.

“Missing from one snapshot” is not automatically “removed from the game.” It remains a diff/gap until evidence or review confirms the removal.

## Queries

Current state uses the version marked `is_current`. Historical reads join introduction/removal versions and compare ordinals. The domain repository `ReadContext.asOfVersionId` exposes this without leaking SQL/provider details.

Change history is obtained from assertion supersession, validity intervals, source snapshot diffs, and verification history. Never update an accepted assertion's value in place.

## Migration versioning

Database migration filenames use a sortable timestamp and description. Released migrations are append-only. Corrections require a new migration. `packages/db/src/migrate.ts` records applied IDs in `app_private.schema_migrations`; Supabase CLI may use the same SQL files through its normal migration workflow.

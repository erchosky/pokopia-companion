# Canonical Data Model

## Identity pattern

`games` is the root. `game_versions.ordinal` supplies a stable total order within a game. Most named domain objects have a row in `entities` and a typed subtype row sharing the same UUID, for example:

```text
entities(id, kind = pokemon)
  1:1 pokemon(id)
    1:N pokemon_forms
    N:M roles / abilities / specialties / habitats / locations
```

This supertype provides one strong foreign-key target for evidence, tags, rules, prerequisites, scoring, search, and user progress without turning game attributes into an EAV model. Stable attributes stay in typed subtype tables.

## Domain coverage

| Context     | Principal tables                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Game        | `games`, `game_versions`, `patches`, `dlcs`, `content_packs`, `events`                                                                                                                                  |
| Pokémon     | `pokemon`, `pokemon_forms`, `pokemon_aliases`, `pokemon_roles`, `pokemon_abilities`, `pokemon_specialties`, `pokemon_habitats`, `pokemon_locations`, requirement/unlock/preference/effect/synergy joins |
| World       | `regions`, `zones`, `locations`, `towns`, `biomes`, `environment_levels`, town resources/facilities/requirements/unlocks                                                                                |
| Items       | `items`, `item_categories`, `item_variants`, `materials`, `resources`, `containers`, `storage_types`, `tools`, `key_items`, `consumables`, sources and unlocks                                          |
| Crafting    | `recipes`, `recipe_ingredients`, `recipe_outputs`, `crafting_stations`, requirements, material sources                                                                                                  |
| Building    | `buildings`, `building_categories`, `furniture`, variants, facilities, structures, methods, requirements, effects                                                                                       |
| Automation  | systems, components, ordered steps, inputs, outputs, effects, compatible locations, role needs, requirements, limitations                                                                               |
| Farming     | `crops`, `plants`, `berries`, production systems/inputs/outputs, cycle times, watering and harvesting methods                                                                                           |
| Progression | quests/steps/requirements, progression nodes, treasure maps, collectibles, achievements, checklists                                                                                                     |
| Iteration 4 | `entity_content_classifications`, typed Treasure Map fields/requirements, Music CD collectible fields, `ditto_moves`, `ditto_move_pokemon`                                                              |
| Rules       | conditions, condition groups, requirements, effects/targets, prerequisites, dependencies, unlock rules                                                                                                  |
| Taxonomy    | categories, tags, roles, aliases, synonyms                                                                                                                                                              |
| Knowledge   | assertions, facts, entity relationships, conflicts, verifications, gaps, research tasks                                                                                                                 |
| Derived     | scoring models/criteria/weights/observations/explanations and FTS projection                                                                                                                            |
| User        | profiles, progress, inventory, town plans, goals, checklists, notes, saved recommendations                                                                                                              |

## Provenance graph

```text
sources
  -> source_snapshots
      -> source_documents
          -> source_evidence
              -> source_assertions
                  -> facts (only after acceptance)
                  -> relationships (when object is another entity)
                  -> source_conflicts / source_verifications
```

An assertion has exactly one typed value: entity, text, number, boolean, or exceptional JSON. It records knowledge kind, lifecycle, confidence, verification status, game-version validity, verification version/time, and a stable hash. Evidence stores the source document, locator, excerpt, and evidence hash.

The `facts` table is an acceptance marker. Inferences and recommendations remain distinguishable by `knowledge_kind`. User state is never stored in this graph.

## Cardinality and integrity rules

- All association tables use foreign keys and composite keys; duplicate relationships cannot be inserted accidentally.
- Symmetric Pokémon synergies use ordered UUIDs (`pokemon_id < other_pokemon_id`) to prevent mirrored duplicates.
- Recipe quantities are positive; probabilities and confidence are bounded from 0 to 1.
- One default form per Pokémon and one current version per game are enforced by partial unique indexes.
- Assertions require exactly one value representation.
- Versioned relations include introduction/removal IDs; introduction is inclusive and removal exclusive.
- Search, score, staging, and diff tables are projections or workflow artifacts, not canonical facts.

## JSONB policy

Permitted uses are intentionally narrow:

- parser/extraction metadata whose shape changes by parser;
- staging records before their domain type is accepted;
- validation messages and snapshot-diff details;
- immutable audit before/after payloads;
- user-defined town layout documents;
- assertion JSON values only for evidence that truly has no stable relational shape.

If a JSON key becomes query-critical, referenceable, or common across records, it must be promoted to a typed column/table by migration.

## Seed contract

`packages/db/src/seed-contract.ts` defines `pokopia-canonical-seed/v1`. Natural keys link parser output deterministically without pre-assigning database UUIDs. A bundle contains source/snapshot identity, documents, entities, assertions, evidence, and version labels.

The included seed CLI validates the bundle only. Promotion is intentionally delegated to the review-gated ingestion flow; it does not mark assertions as accepted facts.

## Iteration 5 runtime projections

Recipe output is `null` with `outputQuantityStatus=unknown` until a source-backed or accepted
measurement assertion exists. The PostgreSQL quantity is nullable and a known value requires an
assertion FK; the former transport default `1` was removed. Player inventory V5 stores ownership
separately from nullable quantity; it remains user state and never enters canonical assertions.
Automation runtime rules distinguish build requirements, infrastructure, operational inputs,
effects, compatibility and accepted measurement parameters.

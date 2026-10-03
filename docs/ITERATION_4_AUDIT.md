# Iteration 4 audit

Date: 2026-08-11  
Baseline: Iteration 3.5 (`6a590091cc7d7645e5cde514716c1b0d8cae3aadf109fa60aefdf0acf79f638e`)

## Verdict

Iteration 4 will extend the existing architecture; it will not replace it. The dual
`GameDataRepository` contract, immutable source snapshot, stable natural IDs, append-only
migrations, local-first player state and evidence/unknown semantics remain mandatory.

Four source-backed domains are suitable for implementation now:

| Domain             | Source evidence                                                                                                | Canonical scope                                                                                    | Decision  |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------- |
| Important Requests | One guide with five named story requests and ordered narrative sections                                        | 5 requests; conservative narrative steps; absent rewards/prerequisites remain unknown              | Implement |
| Treasure Maps      | Guide explicitly states six maps, common requirements, locations, rewards and recipe unlock behavior           | 6 maps; Search specialty and Dowsing Machine requirements; decorative-ball rewards; recipe unlocks | Implement |
| Music CDs          | Table has 53 identified rows; guide states 43 base-game CDs and rows 100–109 explicitly require Expansion Pass | 53 known collectibles: 43 verified base, 10 verified expansion                                     | Implement |
| Ditto Moves        | Structured Move/Effect/Location table                                                                          | 14 moves (10 primary, 4 secondary), kept separate from Pokémon specialties                         | Implement |

Two tempting domains are not sufficiently safe:

- Pokémon forms: the snapshot has named form pages, but no reliable parent/default mapping or
  complete form-difference contract. Keep the pages searchable and record the gap; do not migrate
  speculative form relationships.
- Lost Relics: the guide describes appraisal pools rather than a stable unique collectible set, and
  rows do not provide individual locations. Keep it as a source page and research gap.

## Evidence rules

- Source text is preserved exactly in the canonical snapshot. Runtime projections only normalize
  whitespace and stable slugs.
- `fact`, `assertion`, `inference`, `recommendation` and `user_state` remain distinct concepts.
- Missing prerequisites, rewards, unlocks, completion state and version classification are
  `unknown`; absence is never converted to false.
- Known denominators are labelled as such. Music CD progress is “X of 53 known”, not a percentage of
  all possible game content.
- Requests use narrative steps unless a requirement is explicit and unambiguous. No inferred reward
  is created.
- The Map 6 paragraph calls itself “#5” despite its “Map 6” heading. Identity follows the heading;
  the mismatch is preserved as a data-quality warning, never silently corrected in evidence.

## Version and DLC contract

Every new content projection receives:

- `scope`: `base_game | expansion | unknown`
- `status`: `verified | candidate | unknown`
- a source-backed reason

Music CDs 1–43 are verified base-game because the guide states there are 43 CDs in the game and
lists those rows before the explicit expansion rows. CDs 100–109 are verified expansion because
their location cell says `Requires Expansion Pass`. Requests, Treasure Maps and Ditto Moves remain
unknown because the snapshot does not classify them. Existing item DLC signals remain candidates;
they are not upgraded to verified assignments.

Filters expose All, Base game, Expansion and Unknown. “All” includes unknowns. A filter is a view,
not a claim that excluded content does not exist.

## Progression graph contract

Edges are directed from the activity to what it requires, rewards or unlocks:

- request → requires → entity
- treasure map → requires → Dowsing Machine / Search specialty
- treasure map → rewards → decorative ball
- treasure map → unlocks → decorative-ball recipe
- Ditto move → learned from → Pokémon when the source names one unambiguously

Traversal keeps the existing cycle guard and bounded depth. Narrative-only information remains
narrative and does not become a graph edge.

## Product scope

Iteration 4 adds list/detail experiences for the four accepted domains, version-aware filtering,
Search V4 coverage, Goal Engine V3 target types, My Pokopia V4 tracking and reviewed admin coverage.
All interactive progress remains in browser storage with a backwards-compatible migration.

The iteration does not add cloud sync, hosted Supabase writes, auth, an LLM, a map editor, inventory
quantities or invented optimization metrics.

## Security and reliability pre-audit

The baseline review confirmed parameterized database access, server-only credentials, owner-based
RLS and no hosted user-state writes. It also identified bounded-work and information-disclosure
hardening to complete during this iteration:

- cap public search query/tokens before fuzzy matching;
- reject oversized Goal API bodies before JSON parsing;
- throttle repeated admin password attempts;
- keep the public health response minimal;
- contain ingestion manifest paths within approved roots.

These changes are hardening, not architectural rewrites, and require regression tests.

## Acceptance gates

The review build must demonstrate SQLite/PostgreSQL parity for the new domains, append-only migration
behavior, version filtering, graph direction and cycle safety, goal/next-action behavior, backward
compatible local-state migration, Search V4 and desktop/Pixel 7 journeys. A clean restore must pass
formatting, lint, strict typecheck, unit/integration tests, production builds and Playwright before a
dependency-free review archive is created.

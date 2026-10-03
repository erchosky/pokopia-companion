# Progression graph

## Contract

Progression is a typed, directed projection over canonical entities. An edge describes the subject
on the left; it is never inferred by reversing a document link.

| Predicate                         | Direction       | Meaning                                          |
| --------------------------------- | --------------- | ------------------------------------------------ |
| `treasure_map_requires_item`      | map → item      | The item is needed to act on the map             |
| `treasure_map_requires_specialty` | map → specialty | A Pokémon with that specialty is needed          |
| `treasure_map_rewards_item`       | map → item      | The documented find is the reward                |
| `treasure_map_unlocks_recipe`     | map → recipe    | First acquisition makes the recipe available     |
| `ditto_move_learned_from_pokemon` | move → Pokémon  | The source names that Pokémon in the unlock text |

Important Requests are progression nodes, but their prose is not automatically converted into
requirements or rewards. A Request can therefore be tracked while its machine-actionable dependency
set remains empty. This is intentional evidence discipline.

## Traversal

`getDependencies` follows requirement predicates only, has a configurable depth bound and records
cycles instead of recursing indefinitely. Reward and unlock edges are visible relations but do not
become prerequisites. The graph test for Treasure Map 1 locks direction and the empty-cycle result.

## Unknown behavior

- missing user state is unknown;
- explicit false is a blocker;
- explicit true satisfies the target or requirement;
- absent version classification is unknown;
- narrative order does not imply a hard dependency unless the source states one.

## Scope

Iteration 4 adds five Important Requests, six Treasure Maps, 53 Music CDs and 14 Ditto Moves. Forms
and Lost Relics remain research gaps for the reasons in `ITERATION_4_AUDIT.md`.

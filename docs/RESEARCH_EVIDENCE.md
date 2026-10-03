# Limited P0 research evidence — 2026-08-09

Scope: one bounded pass over current official Nintendo and Pokémon pages for recipe output quantities, container capacities and automation metrics. No broad scraping was performed.

## Source documents

| Kind             | Document                                                                                                                               | Relevant assertion candidate                                                             | Outcome                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Official         | [Nintendo UK product page](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-2-games/Pokemon-Pokopia-2915161.html)                  | The game supports crafting items/furniture and lists DLC recipe acquisition.             | Does not state batch size, container capacity or automation throughput.       |
| Official         | [Nintendo US product page](https://www.nintendo.com/us/store/products/pokemon-pokopia-switch-2/)                                       | The game supports gathering and crafting; current DLC/version context is documented.     | Does not resolve any P0 numeric field.                                        |
| Official         | [Pokémon.com Jirachi event](https://www.pokemon.com/us/pokemon-news/wish-upon-a-jirachi-in-pokemon-pokopia)                            | Official material acknowledges storage containers and a planner.                         | No capacity values are provided.                                              |
| Official support | [Nintendo update history](https://en-americas-support.nintendo.com/app/answers/detail/a_id/71348/~/how-to-update-pok%C3%A9mon-pokopia) | Version 1.1.1 is current on the checked page and patch notes mention placed-item limits. | A placed-item limit is not a container capacity or throughput metric.         |
| Specialist guide | [Serebii: Big storage box](https://www.serebii.net/pokemonpokopia/items/bigstoragebox.shtml)                                           | Flavor text says it is roughly three times bigger than a standard box.                   | Relative statement only; exact capacity remains unknown.                      |
| Specialist guide | [Serebii: Sprinkler](https://www.serebii.net/pokemonpokopia/items/sprinkler.shtml)                                                     | Sprays water over a wide area and has a one-iron-ore recipe.                             | Automation behavior supported; radius remains unknown.                        |
| Specialist guide | [Serebii: Electricity](https://www.serebii.net/pokemonpokopia/electricity.shtml)                                                       | Documents unit demand, generator limits and transmission behavior.                       | Valuable P0 assertion candidates; require review/versioning before promotion. |

## Decision

No P0 value was promoted. Batch size, exact capacity, sprinkler radius and per-system throughput remain unknown. Electricity values enter the review queue as specialist-guide assertion candidates, not canonical facts. The documents are evidence that those surfaces were checked, not negative proof that the values do not exist elsewhere.

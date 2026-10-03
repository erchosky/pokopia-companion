# Research backlog

Generado desde coverage y blockers funcionales de Iteration 2. Todo hallazgo externo debe entrar primero como source document + assertion + evidence; nunca como canonical fact directo.

## P0 — bloquea funcionalidad importante

| Gap                                                           | Bloquea                                   | Evidencia actual                                                                        | Criterio de cierre                                         |
| ------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Output quantity / batch size por receta                       | Craft X copies exacto                     | la tabla da requisitos pero no output quantity                                          | fuente fiable o test manual por familia de receta          |
| Quantity de Gold wall y Confectionery wall (lower)            | dos cálculos exactos                      | las fichas terminan en `Gold ingot *` y `Lumber *`                                      | corregir fuente o verificar cantidad in-game               |
| Capacity de Storage Box, Big Storage Box, Portal Pod y cofres | comparación storage y logistics optimizer | flavor text confirma uso; no hay número                                                 | fuente oficial/especializada corroborada o test controlado |
| Throughput, radio, inputs y límites de sistemas automáticos   | Automation Hub y town optimizer           | 11 candidatos; Serebii electricity aporta candidatos generales, no métricas por sistema | review por assertion y versión; test controlado            |

## P1 — mejora recomendaciones

| Gap                                                       | Impacto                          |
| --------------------------------------------------------- | -------------------------------- |
| Pokémon forms y diferencias funcionales                   | filtros, alternativas y rankings |
| Semántica de specialties combinadas validada por gameplay | confidence de role assignments   |
| Residency limits y compatibilidad real por town           | current vs optimal               |
| Unlock paths fuera de shop level                          | Goal Engine                      |
| Tipado de quests/requests                                 | checklist y progression          |
| DLC/version por assertion, no sólo señal textual          | filtros version-aware            |

## P2 — detalle enciclopédico

- Tipar 14 movimientos de Ditto sin confundirlos con Pokémon abilities.
- Treasure maps y collectibles.
- Cooking, meals y buffs por move.
- Farming: seeds, growth states y harvest yields.
- Facilities, buildings y kits como entidades especializadas.

## P3 — cosmético

- Imágenes faltantes o rotas que no bloquean identificación.
- Color variants y paint areas.
- Rarity visual cuando no afecta planner.

## Fuentes preparadas

Adapters previstos por el modelo existente: Official, Serebii, Editorial Guide, Community Finding y Manual Test. Las fuentes secundarias no reciben prioridad sobre una assertion oficial o un test reproducible.

El pase limitado de 2026-08-09 no resolvió capacities, batch sizes ni sprinkler radius. Sí localizó candidatos specialist-guide de electricidad (demanda por objeto, límites de generación y transmisión), que permanecen en review. Véase [RESEARCH_EVIDENCE.md](./RESEARCH_EVIDENCE.md); nada se promovió automáticamente.

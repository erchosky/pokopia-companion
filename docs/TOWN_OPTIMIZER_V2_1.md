# Town Optimizer V2.1

## Perfiles progresivos

El optimizer separa `owned`, `not_owned` y `unknown`, y ofrece:

- `ideal`: mejor recomendación documentada aunque el usuario no la tenga.
- `owned_only`: sólo candidatos confirmados como Owned.
- `known_collection`: Owned y unknown; excluye únicamente `not_owned` explícito.

La UI muestra mejor Owned frente a mejora ideal y la completitud del perfil. Marcar un solo Pokémon como Owned ya no convierte ese subconjunto en colección completa.

## Restricciones

El modelo no inventa un máximo de residentes. `resident_limit` permanece `unknown`; su tradeoff se explica sin usarlo como número oculto.

## Perfiles A/B/C

La auditoría genera tres escenarios reales de Palette Town: A con toda la colección unknown, B parcial con algunos Owned y C completo Owned/not-owned. Cada salida conserva `ownedRecommendations`, `idealRecommendations` y `knownCollectionRecommendations`.

Evidencia: `audit-data/iteration-3.5/town-optimizer-cases.json`.

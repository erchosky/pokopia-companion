# Search V3.5

## Corrección principal

La deduplicación anterior permitía que el último hit FTS reemplazara un match estructurado mejor. V3.5 reduce por identidad `kind:slug`, conserva el mayor rank y vuelve a ordenar de forma determinista.

## Lenguaje de juego

Los aliases se aplican a todas las búsquedas. Incluyen acentos, typo Portal Pot, shared storage, construcción, automatización, Palette Town y grande/big/large. Las variantes de frase preservan especificidad: “storage grande” produce “big storage” y Big Storage Box vence a “Big drum”.

El intent detector reconoce mejor Pokémon para construir, cómo conseguir Portal Pod, automatizar Palette Town, subir Palette Town, automatización agrícola y comparar storage.

## Regresiones reales

Las diez consultas obligatorias se ejecutan contra la SQLite canónica. Todas devuelven resultados o intent válido. Portal Pod conserva rank 100 en sus variantes; Big Storage Box es el primer resultado de “storage grande”.

Evidencia: `audit-data/iteration-3.5/search-regressions.json` y el test real de `@pokopia/search`.

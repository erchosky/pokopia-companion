# Knowledge Graph — Iteration 3

## Veredicto

La SQLite V3.1 contiene 30.422 relaciones, pero todas son `links_to`: navegación entre documentos. No son hechos de gameplay. La auditoría encontró 121 self-links, 0 endpoints huérfanos y 0 duplicados exactos; las 30.422 permanecen clasificadas como ambiguas para decisiones.

`@pokopia/knowledge` crea una proyección semántica de lectura desde tablas tipadas. El perfil actual produce 7.128 aristas: 5.769 `direct_fact` y 1.359 `derived_fact`. No crea sinergias cuando la fuente no las afirma.

## Contrato

Cada arista incluye:

- entidad origen y destino tipadas;
- predicate y dirección;
- clase: `direct_fact`, `derived_fact`, `inference` o `recommendation`;
- confianza humana: `high`, `medium`, `low` o `unknown`;
- cobertura de evidencia;
- statement, URL, snapshot y estado de verificación;
- versión de juego y método de derivación cuando existen.

API pública:

```ts
resolve(kind, slug);
getRelations(entity);
getRequirements(entity);
getDependencies(entity, maxDepth);
getAlternatives(entity);
getSynergies(entity);
getRelevantTowns(entity);
getRelevantPokemon(entity);
getEffects(entity);
getEvidence(entity);
quality();
```

`getDependencies` limita profundidad y detecta ciclos. `getAlternatives` devuelve candidatos comparables por rol, output o modelo de storage compartido; la clase es `recommendation` y la confianza es baja. `getSynergies` devuelve vacío porque el snapshot no contiene un predicate revisado de sinergia.

## Predicados materializados

| Predicate                            | Conteo | Clase dominante |
| ------------------------------------ | -----: | --------------- |
| `pokemon_performs_role`              |    879 | derived         |
| `pokemon_prefers_habitat`            |    365 | direct          |
| `pokemon_found_at`                   |  1.957 | direct          |
| `recipe_produces_item`               |    882 | direct          |
| `recipe_requires_material`           |  1.333 | direct          |
| `town_unlocks_recipe`                |    222 | direct          |
| `town_unlocks_item`                  |    307 | direct          |
| `entity_requires_unlock_level`       |    218 | direct          |
| `town_has_resource`                  |    100 | direct          |
| `town_has_facility`                  |    775 | direct          |
| `town_lists_exclusive_pokemon`       |     26 | direct          |
| `item_participates_in_automation`    |     11 | derived         |
| `automation_requires_item`           |     17 | direct          |
| `automation_requires_infrastructure` |      9 | derived         |
| `automation_accepts_input`           |      8 | direct          |
| `automation_produces_output`         |     10 | direct          |
| `automation_compatible_with_town`    |      9 | derived         |

Los conteos pueden cambiar cuando cambie el snapshot; no son un denominador de conocimiento completo.

## Trazabilidad

Las fichas de Pokémon y objetos muestran relaciones mediante progressive disclosure. El recorrido implementado es:

`recomendación → capability/relación derivada → evidence statement → source URL`.

La UI usa “Probable”, “Necesita revisión”, “Necesita pruebas” y “Unknown”; no muestra porcentajes de confianza con falsa precisión.

## Límites

- Game version es `null` cuando la fuente no la declara.
- Coocurrencia o hipervínculo no implica sinergia, requisito ni compatibilidad.
- Una localización no implica residencia actual.
- Un valor ausente no se transforma en relación negativa.
- La proyección se construye en memoria y está cacheada por proceso. El cold build medido fue 438 ms; el presupuesto es 500 ms local y debe medirse en el target real.

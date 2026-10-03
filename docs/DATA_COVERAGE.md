# Data coverage — canonical V3.1

## Método

La cobertura compara un proxy fuente reproducible con el contrato tipado que consume el producto. No se usa el total global de 2.532 páginas como denominador de cada dominio. Los unknown denominators se mantienen como `UNKNOWN`.

| Dominio                     | Total source |  Canonicalized |  Unresolved |       Coverage | Base de medida                                                              |
| --------------------------- | -----------: | -------------: | ----------: | -------------: | --------------------------------------------------------------------------- |
| Pokémon                     |          365 |            365 |           0 |           100% | fichas directas `/pokedex/*.shtml`                                          |
| Pokémon forms               |      UNKNOWN |              0 |     UNKNOWN |        UNKNOWN | no se detectan fichas de forma explícitas                                   |
| Specialties                 |           33 |             32 |           1 |         96,97% | índices specialty vs valores usados; `???` no se fuerza                     |
| Ideal habitats              |            6 |              6 |           0 |           100% | índices `idealhabitat` y valores estructurados                              |
| Items                       |        1.700 |          1.700 |           0 |           100% | páginas detalle de item navegables con provenance                           |
| Furniture                   |          138 |            138 |           0 |           100% | `Category=Furniture` en tabla detalle                                       |
| Recipes                     |          882 |            882 |           0 |           100% | unión de outputs en crafting y páginas detalle Recipe                       |
| Recipe quantities           |          882 |            880 |           2 |         99,77% | todos los ingredientes tienen cantidad numérica                             |
| Materials                   |           67 |             67 |           0 |           100% | ingredientes únicos de recetas parseadas                                    |
| Locations / areas           |            7 |              7 |           0 |           100% | páginas detalle `/locations/*`                                              |
| Environment levels          |           64 |             64 |           0 |           100% | pares distintos zona+nivel en unlock tables                                 |
| Unlock rows                 |          524 |            524 |           0 |           100% | filas Name/Level tipadas                                                    |
| Pokémon exclusivos de zonas |           26 |             26 |           0 |           100% | filas en tablas con cabecera explícita List of Exclusive Pokémon            |
| Recursos de zona            |          101 |            101 |           0 |           100% | valores agregados en tablas de recursos detectadas por cabecera             |
| Plantas y bloques de zona   |          552 |            552 |           0 |           100% | valores agregados en tablas propias, sin doble conteo anidado               |
| Facilities de zona          |          775 |            775 |           0 |           100% | valores agregados en tablas de facilities detectadas por posición semántica |
| Abilities / Ditto moves     |           14 |             14 |           0 |     100% proxy | filas conocidas de moves; el total global del juego es desconocido          |
| Important Requests          |            5 |              5 |           0 |     100% proxy | secciones conocidas con pasos narrativos; total global desconocido          |
| Treasure Maps               |            6 |              6 |           0 |     100% proxy | seis secciones conocidas; el total global del juego es desconocido          |
| Music CDs known             |           53 |             53 |           0 |     100% proxy | 43 base y 10 Expansion verificados; no afirma total global                  |
| Automation candidates       |           11 |             11 |           0 | 100% del proxy | conducta operativa explícita en descripción; clasificación derivada         |
| Expansion Pass item pages   |          241 | 241 detectadas | 0 del proxy | 100% del proxy | presencia textual de Expansion Pass; no equivale a catálogo DLC revisado    |

## Distribución de items

Las categorías fuente tipadas son: Other 355, Nature 260, Blocks 232, Misc. 185, Buildings 167, Furniture 138, Utilities 88, Outdoor 85, Kits 60, Materials 58, Food 58 y Key Items 9. Una página no declara categoría y la conserva como unknown.

## Integridad y calidad

- Grain Pokémon: una ficha directa por slug; 365/365 navegables.
- Grain item: una página fuente por entidad navegable; existen dos títulos que colisionan al normalizar puntuación y se desambiguan con el slug fuente.
- Grain recipe: una receta por output item; ingredientes agregados por slug normalizado.
- Grain town/area: una página fuente; unlocks son `(area, level, name, kind)`.
- Las tablas de zona se detectan por cabeceras y relación con la tabla de unlocks. Un índice fijo produjo antes 69 falsos “exclusivos”; el fixture canonical bloquea la regresión.
- Provenance: cada summary/detail conserva URL, snapshot y verification status.
- Roles: no se cuentan como hechos. Cada asignación incluye evidence, confidence, derivation_method y game_version null cuando se desconoce.

## Límites de interpretación

La SQLite canónica contiene 2.593 entidades documentales y 30.422 `links_to`. Estos conteos no se presentan como entidades o relaciones de gameplay revisadas. La capa pública sólo afirma la cobertura de los contratos anteriores.

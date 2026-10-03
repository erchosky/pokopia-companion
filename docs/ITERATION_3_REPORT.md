# Pokopia Companion — Iteration 3 report

Fecha: 2026-08-09.

## Resultado

Pokopia Companion pasa de enciclopedia navegable a companion de decisión: Knowledge Graph tipado, Town Intelligence V2, Scoring V2, Automation Planner, Search V3, comparación y My Pokopia V3. Se conserva Next.js + packages + SQLite canonical + PostgreSQL/Supabase contracts; no hubo rescrape, mocks ni rearquitectura.

## Métricas antes / después

| Señal                       | Iteration 2                 | Iteration 3                                       |
| --------------------------- | --------------------------- | ------------------------------------------------- |
| Grafo gameplay              | 30.422 `links_to` ambiguos  | 7.128 relaciones semánticas separadas             |
| Clases de relación          | no explícitas en producto   | 5.769 direct + 1.359 derived                      |
| Pokémon exclusivos de zonas | 69 (parser incorrecto)      | 26, cabecera verificada                           |
| My Pokopia HTML dev         | 294.054 bytes               | 29.289 bytes, -90%                                |
| My Pokopia UX               | 1.258 checks                | next actions, goals, towns, recents, favorites    |
| Search                      | lexical + aliases           | intent routing + direct answers + history         |
| Town optimizer              | roles actuales/recomendados | 7 presets, residents, health, replacements        |
| Scoring                     | capability/context/evidence | + bands, confidence, marginal team gain, unknowns |
| E2E                         | 10 escenarios               | 22 runs desktop+Pixel 7                           |

## Knowledge Graph y relaciones auditadas

- Raw: 30.422 `links_to`, 121 self-links, 0 orphan endpoints, 0 duplicados exactos.
- Semántico: 7.128 aristas desde contratos tipados; ninguna procede solo de un hyperlink.
- `getDependencies` tiene depth bound y cycle detection.
- Alternatives son recomendaciones de baja confianza; synergies queda vacío por falta de evidence.
- Pokémon/items ofrecen evidence drilldown hasta source URL.

Detalles: `KNOWLEDGE_GRAPH.md`.

## Producto

- **Town Intelligence V2:** residentes explícitos, presets, coverage, duplicados, categorías, health de siete dimensiones y top 3 con why/benefit/tradeoff/confidence/evidence.
- **Best Pokémon V2:** diferencia mejor individuo de mejor incorporación; muestra band, coverage y limits.
- **Automation V2:** sistema+pueblo, requisitos satisfechos/faltantes, sequence, Built y known unknowns.
- **My Pokopia V3:** goals, Next Actions, levels, residents, inferred revert, recents, favorites, searches y migración V1/V2.
- **Search V3:** ejemplos validados: “mejor Pokémon para construir”, “cómo conseguir portal pod”, “qué necesito para subir Palette Town” y “automatizar agricultura”.
- **Comparison:** storage y Pokémon; un unknown nunca gana un eje.
- **IA:** hub `/tools`, command palette global, panel reusable de relaciones y progressive disclosure.

## Coverage

365/365 Pokémon, 1.700/1.700 items, 882/882 recipes, 880/882 cantidades completas, 7/7 zonas y 524 unlocks. Las definiciones exactas están en `DATA_COVERAGE.md`; “100%” es cobertura del proxy fuente, no conocimiento total del juego.

## Performance

Mediciones dev locales con `curl`, una petición por ruta:

| Ruta                  | Antes bytes / tiempo | Después bytes / tiempo | Lectura                                      |
| --------------------- | -------------------- | ---------------------- | -------------------------------------------- |
| `/`                   | 33.023 / 29 ms       | 33.498 / 72 ms         | nueva actividad local; bajo budget           |
| `/my-pokopia`         | 294.054 / 113 ms     | 29.289 / 25 ms         | problema real corregido                      |
| `/automation`         | 97.636 / 79 ms       | 130.773 / 77 ms        | crece por planner; bajo budget de 150 KB     |
| `/towns/palettetown`  | 147.496 / 282 ms     | 170.995 / 68 ms warm   | más inteligencia; bajo budget de 200 KB      |
| `/items/portal-pod`   | no aislado           | 30.950 / 532 ms cold   | incluye cold graph; budget temporal 600 ms   |
| Search intent directo | 55.670 / 197 ms*     | 19.911 / 29 ms         | consultas distintas; comparación orientativa |

`*` baseline “baúl compartido”; after “mejor Pokémon para construir”. No se presentan como benchmark equivalente. Cold Knowledge Graph medido aparte: 438 ms.

El build de producción redujo los payloads medidos a 23.704 B `/`, 23.745 B `/my-pokopia`, 111.593 B `/automation`, 157.422 B `/towns/palettetown` y 21.981 B `/items/portal-pod`. El primer item con graph tardó 290 ms local; las rutas warm quedaron entre 3 y 19 ms salvo detalles Pokémon/graph.

## Research P0/P1

El pase oficial no dio capacities ni batch sizes. Serebii documenta que Big Storage Box es aproximadamente tres veces mayor sin cifra exacta; Sprinkler riega un área amplia sin radio; su guía de electricidad sí publica generación/consumo/límites como candidatos de assertion. Nada se promovió automáticamente. Véanse `RESEARCH_EVIDENCE.md` y `RESEARCH_BACKLOG.md`.

## Arquitectura y cache

- Datos canónicos públicos: adapter server-only y singleton por proceso.
- Knowledge Graph: proyección read-only cacheada; no cruza DB handles al cliente.
- Estado de usuario: localStorage V3 y `useSyncExternalStore`; no se cachea globalmente.
- Search intents: reglas deterministas y testeables, no chatbot ni llamada externa.
- La base Postgres conserva review gates para promociones futuras.

## Screenshots

- `docs/screenshots/iteration-3-my-pokopia-desktop.png`
- `docs/screenshots/iteration-3-town-mobile.png`

## Unknowns abiertos

Storage capacity exacta, batch sizes, dos cantidades incompletas, automation throughput/range por sistema, límite de residentes, compatibilidad real de residencia, rendimiento comparativo de Pokémon, forms, quests y treasure maps.

## Validación final

La matriz cubre direction/traversal/cycles/provenance, unknown handling, marginal scoring, duplicate residents, town health, automation missing requirements, comparison, intents, migration V3 y seis recorridos críticos.

| Gate                            | Resultado                                     |
| ------------------------------- | --------------------------------------------- |
| `npm run format:check`          | PASS                                          |
| `npm run lint`                  | PASS, 0 warnings                              |
| `npm run typecheck`             | PASS, 12 workspaces                           |
| `npm test`                      | PASS, 49 unit/integration tests               |
| `npm run build`                 | PASS, web + admin production                  |
| Playwright desktop + Pixel 7    | PASS, 22/22                                   |
| `npm run data:validate`         | PASS, 2.532 pages / 12.183 tables / 3.308 RAG |
| `npm run data:verify-source`    | PASS, source archive hash verified            |
| SQLite integrity / FK           | PASS, `ok` / 0 violations                     |
| PostgreSQL migration invariants | PASS                                          |

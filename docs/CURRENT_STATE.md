# Current state — Iteration 5.5

Fecha: 2026-08-11. Base activa: `data/canonical/v3.1/pokopia-canonical.sqlite`.

## Veredicto

Iteration 5 está implementada sobre el baseline 4.6 verificado sin reemplazar su arquitectura. Añade
reglas deterministas, crafting recursivo consciente de inventario, readiness de automatización,
simulación inmutable y My Pokopia V5. No se re-scrapeó, desplegó ni auto-promovió evidencia.

## Disponible

- Multi-Goal Planner determinista para 1–20 objetivos con grafo combinado y Action Frontier.
- Shared dependencies/actions, asignación única de inventario y reservas confirmadas.
- Bloqueos separados: gameplay, state, evidence y measurement.
- Pareto/dominancia conservadora, alternatives explícitas y cero master score.
- What-if sobre Simulation V1 sin mutar estado; saved plans locales con staleness.
- Search V5.5 delega intents multiobjetivo a `/planner`.

- Catálogos reales: 365 Pokémon, 1.700 items, 882 recipes y siete zonas.
- Knowledge Graph tipado con direction, class, confidence, evidence, traversal, alternatives y cycle guard.
- Town Intelligence V2 con residents explícitos, siete presets, Town Health y replacements.
- Scoring V2 con individual/team addition, marginal role gain, bands y unknowns.
- Automation Planner V3 con construcción/operación separadas y readiness conservador.
- Comparison Engine para storage y Pokémon.
- My Pokopia V5 local-first: cantidades, infraestructura, goals, residents y migración V4 segura.
- Search V5 con intents deterministas de crafting, automation, bloqueos y siguiente acción.
- Command palette Cmd/Ctrl+K, tools hub y entity relationship panels.
- Admin expone raw document links frente a semantic projection.
- Progresión tipada: 5 Important Requests, 6 Treasure Maps, 53 Music CDs y 14 Ditto Moves.
- Music CDs: 43 verificados como juego base y 10 como Expansion Pass.
- Goal Engine V3 y Next Actions V2 con migración local compatible.
- PostgreSQL/SQLite parity verificada para los cuatro dominios y valores representativos.
- Game Rule Engine V1: 904 reglas tipadas con procedencia y trazas.
- Crafting V2: 882 grafos estructurales, ciclos, alternativas, inventario y excedentes.
- Automation V2 y Simulation V1 inmutable.

## Calidad de datos

- Pipeline: 2.532/2.532 páginas, 12.183 tablas, 57.704 filas propietarias, 13.068 facts, 2.593 entidades y 3.308 RAG chunks.
- Encoding: 48 señales antes, 0 después; U+FFFD 0.
- SQLite integrity/FK: OK; sin WAL/SHM.
- Zonas corregidas: 26 exclusivos, 101 recursos, 552 plantas/bloques, 775 facilities y 524 unlocks.
- 1.326 candidatos SimHash siguen siendo candidatos, no duplicados confirmados.

## Parcial

- `town` incluye áreas; la UI usa “Pueblo / zona”.
- Roles siguen derivados desde specialty y no superan confianza medium.
- Readiness usa cantidades confirmadas; las ausentes permanecen unknown.
- My Pokopia no sincroniza con Supabase todavía; sus datos viven en localStorage.
- El graph se construye in-memory al primer uso; cold local ~438 ms.

## Unknown

Capacity exacta de contenedores, 882 output batch sizes, dos cantidades de receta,
throughput/cycle/consumo productivo, límite de residentes, performance comparativa de
Pokémon, forms y Lost Relics. El scope de versión desconocido permanece unknown.

Estos gaps mantienen exact materials y throughput optimization `unavailable`; structural planning
está disponible y power/time/range son parciales.

## Evidencia cuantitativa 5.1

- 882 outputs están `null/unknown`; no queda un default 1 fingiendo evidencia.
- 880 recetas son partial, dos structural-only y cero exact/disputed.
- 115 evidencias representan 114 hechos; PostgreSQL preserva evidencias concordantes.
- 13/15 sistemas tienen parámetros: electricidad, range, limits, sprinkler y cuatro builds.
- Falta throughput productivo, storage general y compatibility negativa.
- La entrada manual usa files validados y promotion review-gated; no se edita SQLite a mano.

## Seguridad

El esquema PostgreSQL conserva RLS en todas las tablas públicas, ownership por subject JWT, admin desde `app_metadata`, grants explícitos y service role server-only. La prueba dinámica corre contra PostgreSQL local; falta validar advisors contra un proyecto Supabase alojado porque no hay target conectado.

## Referencias

- `ITERATION_3_REPORT.md`
- `ITERATION_3_AUDIT.md`
- `KNOWLEDGE_GRAPH.md`
- `SCORING_V2.md`
- `UX_AUDIT_ITERATION_3.md`
- `DATA_COVERAGE.md`
- `ITERATION_4_REPORT.md`
- `PROGRESSION.md`
- `SEARCH_V4.md`
- `MY_POKOPIA_V4.md`
- `ITERATION_5_REPORT.md`
- `GAME_RULE_ENGINE.md`
- `CRAFTING_ENGINE_V2.md`
- `AUTOMATION_ENGINE.md`
- `MY_POKOPIA_V5.md`

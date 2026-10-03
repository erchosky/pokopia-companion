# Iteration 3.5 — Intelligence & Canonical Hardening

## Veredicto

La Iteración 3.5 cierra los fallos conceptuales detectados en Iteración 3 sin iniciar una Iteración 4. No añade mapas, LLM, despliegue ni un rediseño general. Endurece el runtime canónico, la semántica y la explicabilidad.

## Cambios verificados

- Importador PostgreSQL real: `STAGING -> VALIDATION -> POSTGRESQL`, transaccional, idempotente, con UUID estables, FK, procedencia, assertions candidatas y bloqueo remoto por defecto.
- Backend explícito mediante `POKOPIA_DATA_BACKEND=sqlite|postgres`. Las apps usan el mismo `GameDataRepository`; la lógica de búsqueda, KG, goals, scoring y optimizer no conoce el motor.
- Paridad real SQLite/PostgreSQL: 365 Pokémon, 1.700 items, 882 recetas, 7 pueblos y 11 sistemas de automatización, más Portal Pod, Neo Dowsing Machine y Palette Town.
- KG recursivo: `Neo Dowsing Machine -> recipe -> Dowsing Machine -> recipe -> Pokémetal`, conservando dirección original y el uso inverso producto→receta como traversal explícito.
- Goal Engine V2 con target, status, satisfied, missing, unknown, blockers, graph, next step, alternatives, evidence y confidence.
- Town Optimizer V2.1 con `ideal`, `owned_only` y `known_collection`; `unknown` ya no equivale a `not_owned`.
- Scoring V2 endurecido: capacidad, contexto, cobertura, calidad de evidencia, confianza y marginalidad son señales separadas. La marginalidad sólo ordena en modo equipo.
- Search V3.5 conserva el mejor resultado al deduplicar y pasa las diez consultas de regresión con la SQLite real.
- Multi-source provenance: una relación semántica puede conservar N evidencias; 211 relaciones reales tienen más de una evidencia.
- Versioning diferencia `unknown` de `unversioned_system`; una versión nula ya no se clasifica sin declaración explícita.

## UX/UI pulida

- My Pokopia convierte Portal Pod y otros objetivos en estados explícitos `lo tengo`, `no lo tengo` o `desconocido`, sin deducir propiedad por ausencia de interacción.
- Los objetivos muestran siguiente paso, bloqueos, alternativas y procedencia en la misma vista; la evaluación se ejecuta en memoria y no escribe datos de usuario en el servidor.
- Palette Town separa la composición ideal, los Pokémon confirmados y la colección conocida, y avisa cuando el límite de residentes no está documentado.
- El ranking distingue modo individual y aportación al equipo. Los empates probatorios aparecen resumidos y los candidatos quedan en un desplegable para evitar listas gigantes o posiciones falsas.
- Neo Dowsing Machine expone la cadena recursiva hasta Pokémetal conservando la dirección de las relaciones y mostrando cada nivel de evidencia.

La inspección visual se hizo en Chromium de escritorio y emulación Pixel 7. Los 30 flujos E2E finales pasaron en ambos perfiles.

## Evidencia reproducible

Los artefactos machine-readable están en `audit-data/iteration-3.5/`: `search-regressions.json`, `scoring-regressions.json`, `goal-cases.json`, `town-optimizer-cases.json`, `knowledge-graph-cases.json`, `postgres-parity.json` y `provenance-cases.json`.

## Comandos

```bash
npm run db:seed:dry
DATABASE_URL=postgresql://... npm run db:seed
npm run db:validate
npm run test:postgres --workspace @pokopia/db
npm test
npm run test:e2e
npm run build
```

Gates finales: formato y ESLint sin avisos; typecheck 13/13; 62 tests; E2E 30/30; builds 7/7; SQLite íntegra; PostgreSQL desechable con migraciones, restricciones, dos seeds idempotentes y paridad; 0 vulnerabilidades de producción; escaneo de secretos limpio.

`db:seed` rechaza destinos remotos salvo doble confirmación intencional: `--allow-remote` y `POKOPIA_ALLOW_REMOTE_SEED=I_UNDERSTAND`. La Iteración 3.5 no se ha desplegado ni ha escrito en Supabase de producción.

## Límites honestos

- Las assertions importadas siguen `candidate/unverified`; importar no significa verificar gameplay ni promocionar facts.
- Las dos cantidades de ingrediente desconocidas se conservan en procedencia y no se fuerzan a `1` en filas tipadas.
- No existe un límite de residentes fiable en la fuente; el optimizer lo muestra como `unknown`.
- Los enlaces documentales `links_to` no se transforman automáticamente en relaciones gameplay.

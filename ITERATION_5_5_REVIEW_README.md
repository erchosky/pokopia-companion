# Pokopia Companion — Iteration 5.5 review archive

Archivo limpio, sin dependencias, restaurable e independiente del corpus privado. Incluye código,
lockfile exacto, migraciones, tests, documentación, audit-data 5.5 y la SQLite review compacta.
Excluye secrets, `node_modules`, builds, caches, logs, RAW HTML, master corpus y ZIPs anteriores.

## Restaurar

Requiere Node.js 22+ y npm 10.

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run audit:iteration-5-5
```

Sin la canonical privada, la app resuelve `audit-data/pokopia-review.sqlite`. La experiencia
`/planner` compone de 1 a 20 goals, conserva unknowns, compara escenarios sin mutar estado y nunca
supone `recipe output = 1`.

## Límite de evidencia

Los 882 recipe outputs siguen `null/unknown`; throughput productivo y layout espacial no están
disponibles de forma completa. Structural planning está disponible, mientras exact materials y
throughput optimization permanecen gated por capabilities. El archivo no constituye production GO.

Referencias: `docs/ITERATION_5_5_AUDIT.md`, `docs/ITERATION_5_5_REPORT.md`,
`docs/MULTI_GOAL_PLANNER.md`, `docs/PLANNER_CAPABILITIES.md` y
`audit-data/iteration-5-5/readiness.json`.

# Pokopia Companion — Iteration 5.1 review archive

Archivo limpio, sin dependencias, restaurable e independiente del corpus privado. Incluye código,
lockfile exacto, parsers, tests, migraciones, documentación, audit-data y la SQLite review compacta.
Excluye secrets, `node_modules`, builds, caches, logs, RAW HTML, master corpus y ZIPs anteriores.

## Restaurar

Requiere Node.js 22+ y npm 10.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Sin la canonical privada, la app resuelve `audit-data/pokopia-review.sqlite`. Esa base contiene 882
recipes, 15 automation systems y 115 quantitative evidence records. Para regenerar desde RAW debe
restaurarse por separado el master archive descrito en `docs/MASTER_DATA_ARCHIVE.md`.

## Límite de evidencia

Los 882 recipe outputs están `null/unknown`; no se sustituyen por uno. Hay 114 facts cuantitativos
únicos respaldados por 115 evidencias, pero PostgreSQL los recibe como candidates. Throughput,
storage general, dos ingredient quantities y town compatibility negativa siguen measurement-required.

Referencias: `docs/ITERATION_5_1_AUDIT.md`, `docs/ITERATION_5_1_REPORT.md`,
`docs/GAMEPLAY_MEASUREMENT_QUEUE.md` y `audit-data/iteration-5-1/readiness-summary.json`.

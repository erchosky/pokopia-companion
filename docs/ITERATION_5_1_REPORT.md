# Iteration 5.1 — informe

## Resultado

El planner ya puede usar parámetros aceptados de build, electricidad, range y capacity documentada.
No puede prometer batch, items/minute o tiempos completos de producción.

### Before

- recipes exact: 0/882;
- automation quantitative: 0/11;
- outputs transportados como default 1 sin evidencia.

### After

- exact 0; partial 880; structural-only 2; disputed 0;
- recovered output quantities 0; recovered input quantities 0;
- dos input quantities siguen `measurement_required`;
- 115 evidencias para 114 hechos cuantitativos únicos;
- quantitative automation 13/15; en los originales, 9/11;
- cuatro production candidates source-backed;
- build timing, power, transmission range/connections/limits y sprinkler recuperados;
- 882 output batches y dos ingredients requieren gameplay.

El límite de 1.024 electric items tiene dos evidencias concordantes (mechanic y patch): PostgreSQL
conserva un hecho y dos evidencias.

## Integración

- canonical SQLite: `quantitative_assertions`;
- PostgreSQL: `quantitative_parameters` review-gated y recipe quantities nullable con provenance;
- GameDataRepository y Rule Engine usan parámetros aceptados;
- rates matemáticos conservan parámetros padre;
- admin muestra recipe/automation coverage;
- Automation UI etiqueta valores conocidos sin prometer throughput.

Gates y clean restore: `ARCHIVE_REPORT_ITERATION_5_1.md`.

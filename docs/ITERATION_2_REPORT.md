# Iteration 2 report — Pokopia Companion

Fecha de cierre: 2026-08-09. Base de datos: canonical V3.1, sin nuevo scraping.

## Resultado

Pokopia Companion ha pasado de ser un visor parcial del snapshot a una herramienta jugable de consulta, planificación y progreso. La misma SQLite canónica alimenta Pokédex, objetos, recetas, zonas, buscador, recomendaciones, automatización y admin. Los datos desconocidos siguen siendo `null` o `unknown`; ninguna laguna se rellena por conveniencia.

## Cobertura entregada

| Superficie      | Entrega comprobable                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Pokédex         | 365 fichas, filtro instantáneo, specialty, hábitat, localizaciones, roles trazables y progreso Owned        |
| Objetos         | 1.700 páginas navegables con categoría, localización, receta, storage, DLC como señal y provenance          |
| Recetas         | 882 outputs; 880 con cantidades completas, cálculo recursivo para N copias y detección de ciclos            |
| Pueblos / zonas | 7 páginas, 524 unlocks, recursos, facilities, tesoro, Pokémon relacionados e inferencia segura de niveles   |
| Automation Hub  | 11 candidatos conservadores con qué hace, requisitos, desbloqueo, inputs/outputs, límites y readiness local |
| My Pokopia      | Estado local versionado, confirmed/inferred/unknown, objetivos y migración desde V1                         |
| Recomendación   | Scoring V1 con capability, contexto y calidad de evidencia separados; null nunca se convierte en cero       |
| Admin           | Cobertura por denominador y cola priorizada de investigación                                                |

Las definiciones exactas y límites están en [DATA_COVERAGE.md](./DATA_COVERAGE.md), [SCORING_V1.md](./SCORING_V1.md) y [RESEARCH_BACKLOG.md](./RESEARCH_BACKLOG.md).

## Flujos de producto validados

1. Buscar “Portal Pod”, abrir la ficha y marcarlo como adquirido.
2. Marcar un nivel de Palette Town y comprobar estados confirmed/inferred y siguiente acción.
3. Marcar un Pokémon Owned y verlo en My Pokopia.
4. Calcular una receta para cinco copias con totales directos y base.
5. Abrir un ranking y entender score, evidencia y empates.
6. Comparar un pueblo con un preset del optimizer y ver roles cubiertos, ausentes y candidatos.

Estos flujos tienen cobertura Playwright en desktop y Pixel 7. Las capturas principales están en [docs/screenshots/iteration-2](./screenshots/iteration-2/).

## Qué herramientas funcionan

- Craft planner directo y recursivo para cualquier receta estructurada, incluyendo multiplicación por copias, materiales base, dependencias, unknowns y ciclos.
- Search de entidades y texto completo con consultas como `Portal Pod`, `portal pot`, `baúl compartido` o `Pokémon para regar`.
- Rankings explicables para construcción, farming/watering, automatización, producción, recursos, logística, progresión, exploración y minería, en español o inglés. Un contexto fuera del mapping devuelve evidencia insuficiente.
- My Pokopia, Goal actions, `Can I build this?`, inferencia de niveles y Town Optimizer funcionan sin cuenta con persistencia local.

## Automatizaciones disponibles

El filtro final conserva 11 fichas: Automatic doors, Bubble machine, Floor switch, Mini generator, Portal pod, Sprinkler, Utility pole y cuatro componentes Wireless power-transmitter. Arcade machine, Dowsing Machine, Punching game, Vending machine y otras máquinas manuales o decorativas quedaron fuera tras la auditoría semántica.

Cada ficha distingue materiales de construcción de inputs/outputs operativos. Cuando Pokémon, infraestructura, input, output, capacidad, radio o throughput no aparecen en la fuente, la UI muestra `Desconocido`.

## Zonas suficientemente modeladas

Bleak Beach, Bubbly Basin, Cloud Island, Palette Town, Rocky Ridges, Sparkling Skylands y Withered Wastelands disponen de detalle y progression hasta Environment Level 10. “Suficientemente modelada” significa cobertura completa de las tablas disponibles de descripción, unlocks, recursos, facilities, tesoro y Pokémon relacionados; no implica que residencia, layout óptimo o throughput estén confirmados.

## Decisiones de UX y rendimiento

- Home orientada a problemas concretos: qué fabricar, quién sirve para una tarea, qué falta y cómo continuar.
- Progressive profiling: el usuario puede empezar sin cuenta y confirmar sólo lo que conoce.
- La UI diferencia fuente, derivación e insuficiencia de evidencia.
- Búsqueda bilingüe ES/EN con aliases, conceptos de rol y corrección limitada de typos.
- Los catálogos completos se leen una vez por proceso y se reutilizan; los payloads de Pokédex y optimizer envían al cliente sólo los campos interactivos necesarios.
- Se conservan los índices canónicos existentes: no se añadió un índice sin evidencia de cuello de botella.
- La QA visual descubrió y corrigió un falso positivo de dominio: “machine” por sí solo ya no convierte una ficha manual o decorativa en automatización.

Perfil local de cierre sobre la SQLite real: Pokémon 74,2 ms; objetos 72,2 ms; recetas 54,6 ms; zonas 5,4 ms; automation 1,8 ms. Las búsquedas medidas quedaron entre 40,6 y 104,5 ms. Son medidas orientativas de una sola ejecución local, no un SLA.

## Auditoría técnica

El cierre exige todos estos gates en verde:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run data:validate
npm run test:postgres --workspace @pokopia/db
npx playwright test
```

Además se verifica `PRAGMA integrity_check` y `PRAGMA foreign_key_check` sobre la SQLite canónica. Los resultados finales se registran en la entrega, no se asumen a partir de ejecuciones anteriores.

## Riesgos que permanecen

- Output quantity por fabricación se trata como uno derivado porque no existe batch size en el snapshot.
- Dos recetas contienen una cantidad ilegible y se mantienen como unknown.
- Capacity, radio y throughput de automation siguen desconocidos.
- Los roles proceden de un mapping explícito sobre specialty; son inferencias trazables, no pruebas de gameplay.
- My Pokopia es local-first. No se ha conectado ni modificado un proyecto Supabase alojado.
- Forms, requests, treasure maps, cooking y farming requieren parsers propios y no se mezclan con dominios ya validados.

## Estado de investigación

Un pase oficial limitado revisó Nintendo y Pokémon.com para los blockers P0. No encontró batch sizes, capacidades ni métricas de throughput, por lo que no se promovió ningún valor. El registro está en [RESEARCH_EVIDENCE.md](./RESEARCH_EVIDENCE.md).

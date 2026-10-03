# UX audit — Iteration 3

Fecha: 2026-08-09. Validación real en Chromium desktop y viewport Pixel 7, sobre la SQLite canónica. Los conteos son interacciones principales aproximadas y no incluyen scroll ni apertura opcional de evidencia.

## Veredicto

La principal mejora no es visual: las decisiones ahora aparecen antes que los catálogos. Town Intelligence subió por encima de las tablas largas; My Pokopia dejó de ser un checklist de 1.258 entradas y pasó a próximos pasos; Search ofrece rutas-respuesta; Automation incorpora un planner. No se añadió onboarding obligatorio.

## Recorridos

| Intención                           | Antes                                                       | Después                                                            | Clicks / navegación | Dead end |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ | ------------------: | -------- |
| Conseguir Portal Pod                | buscar → resultado → ficha                                  | pregunta → respuesta directa → ficha → goal/acquired               |               2 / 2 | no       |
| Elegir residentes para Palette Town | zona → datos largos → optimizer V1; Owned podía confundirse | zona → nivel → residentes explícitos → health → replacement        |             2–4 / 1 | no       |
| Automatizar farming                 | catálogo de sistemas                                        | búsqueda/intención → planner → sistema+pueblo → secuencia+unknowns |             2–3 / 1 | no       |
| Pokémon bueno para construir        | URL/ranking básico                                          | búsqueda → direct answer → ranking V2 → evidencia → compare        |               3 / 2 | no       |
| Fabricar 5 unidades                 | receta → cantidad                                           | igual, con direct/base/dependencies y cycle guard                  |               2 / 1 | no       |
| Saber qué hacer ahora               | checklist completo                                          | Home/My Pokopia → Next Actions ordenadas por goal/impact/effort    |               1 / 1 | no       |

## Hallazgos corregidos

1. P0: cinco páginas de zona interpretaban una tabla de recursos como Pokémon exclusivos. El parser ahora identifica cabeceras, no índices fijos.
2. P0 UX/performance: My Pokopia enviaba ~294 KB de HTML y 1.258 checks. Ahora envía ~29 KB y prioriza decisiones; reducción aproximada del 90%.
3. P1: el optimizer estaba después de facilities, plantas y unlocks. Ahora aparece inmediatamente después del nivel.
4. P1: “Owned” podía leerse como residente. La composición se confirma por pueblo y lo explica explícitamente.
5. P1: porcentajes de confianza parecían exactos. Se sustituyeron por etiquetas humanas y evidence drilldown.
6. P1: la búsqueda de preguntas devolvía listas sin respuesta. Cinco intents críticos enrutan a la herramienta correcta.
7. P2: no existían recents/favorites ni acceso global. Se añadieron actividad local y Cmd/Ctrl+K; en móvil queda un trigger flotante de 52 px.
8. P2: listas de facilities y plantas saturaban la página. Se muestran 18 y el resto queda en disclosure.

## Visual y accesibilidad

- Navegación horizontal scrollable en móvil, targets mínimos de 42–52 px y foco visible.
- Dialog de comandos con `role=dialog`, `aria-modal`, Escape y foco inicial.
- Estados no dependen solo de color; incluyen texto Complete/Partial/Missing/Unknown.
- `prefers-reduced-motion` desactiva transiciones.
- Los detalles avanzados se ocultan sin retirar la evidencia.

## Evidencia visual

- `docs/screenshots/iteration-3-my-pokopia-desktop.png`
- `docs/screenshots/iteration-3-town-mobile.png`

## Pendiente

- Traducir el contenido fuente inglés sin perder el original requeriría una capa editorial versionada.
- El selector de 365 residentes usa el select nativo: accesible pero denso. Un combobox virtualizado es P2 si las métricas reales muestran fricción.
- La ruta de Palette Town sigue siendo la mayor entre las medidas manuales (~171 KB) por catálogo y props del optimizer; presupuesto provisional 200 KB.

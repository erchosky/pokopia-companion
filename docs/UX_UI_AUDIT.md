# Auditoría UX/UI — 2026-08-09

## Alcance y método

Revisión del primer vertical funcional contra la SQLite canónica V3.1. Se inspeccionaron home,
búsqueda, listado, ficha Pokémon y My Pokopia en Chromium a 1440 × 1000 y 390 × 844. La revisión
combinó estructura semántica, navegación por teclado, claridad de contenido, jerarquía visual,
responsive y flujos Playwright existentes.

## Veredicto inicial

La base visual era consistente, legible y funcional, pero se comportaba más como un explorador
técnico de datos que como un companion de juego. La trazabilidad estaba bien resuelta; faltaban
orientación a tareas, lenguaje humano y herramientas para manejar colecciones largas.

## Hallazgos y resolución

| Prioridad | Hallazgo observado                                                             | Impacto                                                    | Resolución aplicada                                                                                                   |
| --------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Alta      | La navegación móvil se partía en tres filas y empujaba el contenido principal. | Pérdida de espacio y exploración lenta.                    | Cabecera sticky, navegación horizontal de una fila y targets táctiles consistentes.                                   |
| Alta      | My Pokopia mostraba 90 checks sin búsqueda, filtros ni agrupación semántica.   | Encontrar y marcar una entrada requería demasiado scroll.  | Búsqueda local, filtros Todo/Pokémon/Recetas, contador de resultados, estados en español y feedback visual del check. |
| Alta      | La búsqueda repetía la misma descripción en cada resultado.                    | No explicaba por qué una coincidencia era útil.            | Se muestra el extracto real, tipo localizado, mejor coincidencia destacada y un límite más manejable.                 |
| Media     | Home dependía casi por completo de una caja de búsqueda.                       | Usuarios nuevos no sabían qué podían hacer.                | Cuatro accesos orientados a tareas y consultas sugeridas en español.                                                  |
| Media     | FTS, facts, canonical, UNKNOWN y otros términos internos dominaban el copy.    | Elevaba la carga cognitiva y parecía una consola de datos. | Lenguaje de producto en el flujo principal; trazabilidad conservada como información secundaria.                      |
| Media     | Especialidades concatenadas como `WaterScrub` o `TeleportTrade`.               | Lectura poco natural.                                      | Presentación humana sin modificar el valor canónico almacenado.                                                       |
| Media     | Las tarjetas no siempre comunicaban que eran accionables.                      | Affordance débil.                                          | Altura coherente, acción explícita, hover/focus y jerarquía de contenido.                                             |
| Baja      | No existía enlace para saltar la navegación repetida.                          | Fricción para teclado y lectores de pantalla.              | “Saltar al contenido” visible al recibir foco y destino enfocable.                                                    |
| Baja      | Las fichas no ofrecían retorno contextual.                                     | Dependencia del botón Atrás del navegador.                 | Enlace de vuelta a la colección en cada ficha.                                                                        |

## Principios mantenidos

- No se inventan datos para llenar huecos visuales.
- Los valores canónicos no se modifican; solo cambia su presentación.
- Las recomendaciones continúan diferenciadas de los datos extraídos.
- My Pokopia continúa siendo local, privado y versionado.
- Las páginas siguen siendo Server Components salvo la interacción local estrictamente necesaria.

## Validación de cierre

- Formato, ESLint y TypeScript estricto: PASS.
- 29 pruebas unitarias: PASS.
- Builds de producción web y admin: PASS.
- 10 escenarios Playwright en desktop y móvil: PASS.
- Home, búsqueda, ficha y My Pokopia inspeccionados visualmente antes y después.
- Sin overflow horizontal a 1440 × 1000 ni 390 × 844.
- Sin errores de consola después de incorporar el favicon de aplicación.
- Foco visible, enlace para saltar navegación y reducción de movimiento conservados.

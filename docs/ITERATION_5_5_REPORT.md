# Iteration 5.5 — informe final

## Respuestas

- ¿Planifica múltiples goals? Sí, de 1 a 20 en un grafo combinado.
- ¿Identifica shared requirements? Sí; el caso real encuentra cuatro.
- ¿Evita duplicar recursos? Sí; agrega demanda y asigna inventario una vez.
- ¿Encuentra la mejor siguiente acción conocida? Sí cuando una domina bajo política explícita.
- ¿Admite equivalencia? Sí; devuelve Action Frontier y `nextBestKnownAction=null`.
- ¿Solicita información útil? Sí; una cantidad unknown genera confirmación, no “consigue X”.
- ¿Compara sin fake score? Sí; Pareto/dominancia conservadora o `incomparable`.
- ¿Qué optimiza? Estructura, requisitos compartidos, blockers, information gain e inventario conocido.
- ¿Qué sigue estructural? Recetas y production chains con batch/throughput unknown.
- ¿Qué bloquean measurements? Materiales recursivos exactos, surplus, crafts, tiempo y throughput.

## Producto

`/planner` permite elegir goals, pueblo, versión, scope Base/DLC y preferencia explícita; muestra
summary, shared dependencies, frontier, confirmaciones, measurement blockers, capabilities, grafo
textual, alternativas, trazas, comparación what-if, acciones fijadas, progreso local, saved plans y
export texto/JSON. Search 5.5 delega intents al Planner.

## Ingeniería

El nuevo package depende de Goals y Rules. La API valida payload, limita a 20 goals, reutiliza rate
limiting y construye snapshots server-side. Simulation no modifica My Pokopia. Tests adversariales
cubren ciclos, DLC, 20 goals, determinismo, resource allocation, unknown batches, Pareto, escenarios
inmutables y stale plans.

Iteration 6 debe medir datos cuantitativos antes de prometer optimización productiva avanzada.

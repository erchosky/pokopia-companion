# Multi-Goal Planner

`@pokopia/planner` compone de 1 a 20 goals contra un `PlayerStateSnapshot` inmutable. Su entrada
incluye catálogo del Goal Engine, recetas del Rule Engine, métricas aceptadas, constraints y
preferencias explícitas. Su salida es `PlanResult`, no texto libre.

## Flujo

```text
Goal Engine + Knowledge Graph
            ↓
Crafting / Automation / Simulation
            ↓
@pokopia/planner
            ↓
graph + blockers + actions + frontier + alternatives + capabilities + traces
```

Los nodes compartidos se deduplican y conservan todos sus `goalIds`. El inventario se agrega antes
de asignarse, por lo que la misma unidad confirmada no satisface dos demandas. Un batch unknown
detiene el total recursivo y crea un measurement blocker sin inutilizar el grafo estructural.

El contexto de pueblo proyecta únicamente la infraestructura confirmada o ausente del pueblo
seleccionado; otros pueblos no contaminan la evaluación. La versión del juego participa en el hash
del snapshot y en la detección de planes stale. Una acción fijada solo pasa al frente si sus
prerrequisitos no siguen pendientes; en caso contrario el plan explica por qué no puede adelantarla.

`compareScenarios` ejecuta dos what-if con Simulation V1 y compara solo completed goals, blockers y
acciones estructurales conocidas. Si una incertidumbre crítica puede invertir el resultado, devuelve
`incomparable`; nunca infiere velocidad, throughput o ahorro temporal.

## Acciones

- gameplay: craft/build/obtain/complete/unlock/place;
- confirmation: cantidad, ownership o infraestructura;
- research: measurement/evidence unresolved;
- decision: recipe, town u optional route.

La `Action Frontier` conserva acciones no diferenciables. La política por defecto es lexicográfica y
documentada: requerida por todos, alto impacto compartido, bloqueo confirmado, confirmación de
estado y certeza. No convierte tiempo, materiales y certeza en un score.

## Determinismo y límites

Goals se ordenan por ID, maps se materializan ordenados y el fingerprint usa serialización estable.
Hay guard de 20 goals, profundidad 32, memoization por target/state/context y cycle guards heredados.
Mismo input produce el mismo plan.

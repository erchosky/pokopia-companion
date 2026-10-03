# Iteration 5.5 — auditoría previa y cierre

## Baseline verificado

El baseline autoritativo es `Pokopia-Companion-Iteration-5.1-REVIEW.zip`, SHA-256
`81c4183272d1e10a8e6cc56f8eb533f9ac191fac8ff3a21a62cf29498fb43a04`. La implementación
continúa los contratos existentes; no reescribe Game Logic, Goal Engine, Crafting ni Simulation.

## Primitivas reutilizadas

| Primitiva        | Reutilización en 5.5                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| Goal Engine V4   | Evalúa cada target contra el snapshot antes de componerlos.                     |
| Knowledge Graph  | Entrega dependencias tipadas, dirección, ciclos y evidencia.                    |
| Crafting V2      | Calcula cantidades conocidas, corta en batches unknown y conserva alternativas. |
| Automation V2    | Mantiene construcción y operación separadas.                                    |
| Simulation V1    | Aplica what-if sobre clones; nunca sobre estado confirmado.                     |
| My Pokopia V5    | Proporciona inventario/entries acotados e inmutables durante planning.          |
| Quantitative 5.1 | Habilita power/range/build duration solo donde hay parámetros aceptados.        |

## Duplicaciones evitadas

- El Planner no vuelve a implementar recetas, requisitos, readiness ni efectos.
- La API construye el catálogo y llama `planGoals`; React no decide prioridades.
- Search solo reconoce intents y delega a `/planner`.
- Saved plans guardan goals, preferencias, revisión y progreso, no la canonical DB.

## Qué puede optimizarse

- disponible: composición multiobjetivo, dependencias compartidas, orden estructural, asignación de
  inventario confirmado, information gain y acción compartida;
- parcial según contexto: materiales directos conocidos, build duration aplicable, power y range sin
  layout; una métrica global no habilita una capability para un goal no relacionado;
- estructural: recipe chains, alternatives y critical dependency path;
- bloqueado: batches exactos 0/882, throughput/cycles, Furnace consumption, storage general,
  compatibilidad negativa y spatial layout.

## Hallazgos del corpus real

- Portal Pod + Automatic Doors produce un plan estructural de 18 nodos/16 aristas y nueve blockers;
- Antique Chandelier + Antique Clock comparten Glass, Iron ore, Lumber y Twine en un único grafo;
- en ese caso las cuatro confirmaciones forman una frontera equivalente: no existe ganador demostrado;
- `structuralPlanning=available`; exact materials y throughput permanecen `unavailable`;
- el último caso de 20 objetivos midió 5,1 ms localmente en Node 22; el delta de heap es orientativo y
  puede ser negativo por GC.

Evidencia reproducible: `audit-data/iteration-5-5/`.

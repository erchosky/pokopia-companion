# Plan Trace

Cada `PlanTrace` conecta:

```text
goal → requirement → rule/predicate → player-state revision → plan action → consequence
```

Incluye `goalId`, `requirementId`, `ruleId`, `playerStateRef`, `actionId`, consecuencia y evidence
IDs. La traza no transforma verificación de fuente en aceptación canonical ni mezcla confianza con
coste.

La UI expone una vista textual dentro de progressive disclosure. El grafo visual nunca es la única
forma de entender el plan. Los diagnósticos de nodes, edges, targets memoizados y ramas dominadas se
mantienen machine-readable para admin/dev sin publicar secretos.

# Goal Engine V2

## Salida contractual

Cada evaluación contiene `target`, `status`, `satisfied`, `missing`, `unknown`, `blockers`, `dependencyGraph`, `nextStep`, `alternatives`, `evidence`, `confidence` y razones reconstruibles.

Tipos cubiertos: conseguir item, fabricar item, alcanzar nivel de pueblo, construir automatización y adquirir Pokémon.

## Semántica de estado

- Ausencia de una entrada de usuario = `unknown`, nunca `not owned`.
- `confirmed:false` = falta explícita y puede ser blocker.
- `confirmed:true` = satisfacción explícita.
- Una meta se completa sólo al confirmar el target, no por una inferencia de receta o localización.
- Una cantidad, unlock o localización desconocida se mantiene en `unknowns`.

## Siguiente paso

Se elige primero un bloqueo explícito. Si no existe, se escoge una dependencia hoja desconocida. Si no hay requisitos estructurados, se remite a la ficha del target.

La confianza depende de cobertura de estados y evidencia enlazada. Una assertion `unverified` no produce confianza alta sólo por tener muchos campos.

La UI de My Pokopia llama una ruta efímera sin persistencia: el progreso continúa en `localStorage`; la respuesta sólo contiene evaluación derivada.

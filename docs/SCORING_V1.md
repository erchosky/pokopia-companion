# Scoring engine V1

## Principio

V1 ordena únicamente cuando existe una relación explicable entre el objetivo y un role derivado de una specialty estructurada. La ausencia de evidencia es `null`, nunca `0`.

## Tres scores

1. `objective_capability_score`: máxima confianza de un role compatible con el objetivo.
2. `contextual_score`: ajuste a un contexto estructurado conocido. Si no existe relación de contexto, queda null.
3. `recommendation_score`: media ponderada sólo sobre dimensiones conocidas. Requiere capability conocida.

Fórmula:

```text
known_weight = Σ weight_i donde value_i != null
recommendation = Σ(value_i × weight_i) / known_weight
```

`evidence_quality` vale 0,5 para specialties estructuradas aún `unverified`. No se transforma en 1 por aparecer en una tabla.

## Presets

| Preset      | Capability | Context | Evidence |
| ----------- | ---------: | ------: | -------: |
| Balanced    |       0,65 |    0,20 |     0,15 |
| Automation  |       0,75 |    0,10 |     0,15 |
| Production  |       0,70 |    0,15 |     0,15 |
| Progression |       0,60 |    0,25 |     0,15 |
| Compact     |       0,70 |    0,20 |     0,10 |
| Endgame     |       0,65 |    0,15 |     0,20 |

## Roles V1

El mapping es semántico y explícito. Ejemplos: `Build → construction/building`, `Water → watering/farming`, `Generate → electricity/power/resource-generation`, `Storage → storage/logistics`, `Teleport → transport/logistics/exploration`. Cada resultado conserva el token de specialty como evidence y `specialty_mapping_v1` como método.

Roles no mapeables no reciben capacidades concretas; pueden permanecer `specialist`. Un contexto sin roles fiables devuelve `insufficient evidence` y no una lista ordenada.

## Empates y precisión

Dos Pokémon con los mismos datos pueden tener el mismo score. El desempate alfabético sólo estabiliza la UI y no afirma superioridad. La pantalla lo declara explícitamente.

## Tests

- Match de role directo y contribuciones visibles.
- Dimensiones ausentes permanecen null.
- Contextos sin mapping devuelven cero resultados explicables.

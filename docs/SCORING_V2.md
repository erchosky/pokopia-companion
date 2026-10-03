# Scoring V2

## Objetivo

Responder “qué Pokémon encaja mejor” sin convertir datos incompletos en una clasificación falsa. El ranking separa capacidad, ajuste contextual, cobertura probatoria y ganancia marginal para un equipo.

## Salidas separadas

| Campo                      | Significado                                                                     |
| -------------------------- | ------------------------------------------------------------------------------- |
| `objectiveCapabilityScore` | Fuerza de la coincidencia entre specialty derivada y roles pedidos.             |
| `contextualScore`          | Coincidencia estructurada de contexto cuando existe; si no, `null`.             |
| `evidenceCoverage`         | Peso del modelo respaldado por valores conocidos; no es probabilidad de verdad. |
| `recommendationScore`      | Media ponderada renormalizada solo sobre dimensiones conocidas.                 |
| `marginalRoleGain`         | Roles pedidos que el equipo actual no cubre.                                    |
| `confidence`               | `medium` o `low`; V2 no concede `high` a specialties sin gameplay revisado.     |
| `recommendationBand`       | `strong`, `useful` o `situational`.                                             |

## Reglas

1. `unknown` permanece `null`; nunca vale cero.
2. Un candidato sin rol compatible no entra en el ranking.
3. El modo `team_addition` ordena primero por ganancia marginal y después por score.
4. Un empate probatorio se desempata alfabéticamente y la UI lo explica.
5. La specialty no confirma residencia, sinergia ni rendimiento comparativo.
6. Cada resultado enumera unknowns y evidencia de cada dimensión.

## Presets

Balanced 65/20/15, Automation 75/10/15, Production 70/15/15, Progression 60/25/15, Compact 70/20/10 y Endgame 65/15/20 para capability/context/evidence. Los pesos son una política de producto versionable, no un hecho del juego.

## Calidad actual

- 365 candidatos disponibles.
- 879 asignaciones role derivadas.
- 33 specialties fuente, 32 estructuradas; una permanece unresolved.
- confianza máxima expuesta: `medium`.
- tests cubren unknown handling, ranking explicable y ganancia marginal.

## Pendiente

No hay benchmarks revisados de velocidad de trabajo, throughput, radio o sinergia. Hasta obtener evidencia reproducible, V2 recomienda por cobertura funcional y declara ese límite.

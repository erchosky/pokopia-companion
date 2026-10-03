# Modelo de optimización

## Dos capas

Structural Planning funciona con dependencias, unlocks y estado. Quantitative Optimization solo usa
dimensiones aceptadas. Cada capability publica `available`, `partial` o `unavailable` con razón.

## Dominancia conservadora

A domina B únicamente cuando es igual o mejor en todas las dimensiones conocidas comparables,
mejor en una y ningún unknown crítico puede invertir el resultado. En cualquier otro caso son
`incomparable`. Los trade-offs permanecen en un frente Pareto; no hay master score.

Dimensiones disponibles en el contrato: materiales confirmados, build time conocido, profundidad de
progresión, blockers, utilidad multi-goal, power conocido y certeza. “Más certeza” no significa
“mejor gameplay”.

## Cantidades

Los materiales directos conocidos se agregan y el inventario se asigna una sola vez respetando
reservas. Batches desconocidos impiden calcular crafts, materiales recursivos y surplus exacto. Un
shared intermediate puede identificarse aunque su excedente reutilizable sea `null`.

No se optimizan completion time, throughput o factory layout sin tiempos, ciclos y posiciones.

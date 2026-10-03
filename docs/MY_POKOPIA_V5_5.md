# My Pokopia V5.5

My Pokopia enlaza a una experiencia `/planner` con Goals, Next Actions, Shared Requirements,
Unknowns, knowledge blockers y what-if. El dashboard existente no se convierte en un grafo masivo.

El planning lee `pokopia-progress-v5` pero no lo modifica. Confirmar una cantidad o marcar una
construcción como hecha requiere una acción explícita y muestra el campo afectado. No hay
auto-complete basado en simulación.

Planes y escenarios se guardan localmente en `pokopia-planner-v5-5`, con máximo 20. Un saved plan
incluye goals, preferences, constraints, revisión de player state, data version, game version y
acciones completadas. Si cambia una de esas revisiones se muestra como potencialmente stale y debe
recalcularse.

La UI permite seleccionar el pueblo actual, declarar una versión opcional, fijar una acción para el
próximo cálculo y marcar progreso exclusivamente dentro de un saved plan. Estas marcas locales no
confirman automáticamente el estado real del juego.

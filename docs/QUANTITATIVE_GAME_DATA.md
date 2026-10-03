# Quantitative game data

Un parámetro conserva subject, predicate, value, unit, qualifier, derivation, source, locator,
excerpt, parser/evidence confidence, verification, acceptance, content scope y game version. La
unidad forma parte del dato.

El parser puede leer bien un valor sin probar que la fuente sea correcta. Source verification,
assertion acceptance y canonical promotion son estados independientes. PostgreSQL importa estos
hechos como candidates incluso cuando la extracción local está aceptada.

`null` representa unknown; jamás se rellena con cero o uno. `disputed` conserva ambas evidencias y
bloquea cálculo. Una derivación matemática referencia sus parámetros padre.

Un rate solo se calcula si quantity y duration son aceptados y compatibles. La base es item/second y
item/minute se marca `mathematical_derived`. Con batch unknown una cadena es estructural, no exacta.

PostgreSQL permite `recipes.batch_size` y `recipe_outputs.quantity` null. Un valor requiere status
`source_backed` o `accepted_measurement` y FK a `source_assertions`, impidiendo el antiguo default.

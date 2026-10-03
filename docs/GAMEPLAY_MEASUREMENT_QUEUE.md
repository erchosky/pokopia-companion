# Gameplay measurement queue

La cola solo contiene valores no recuperables del corpus. Electric item limit, transmitter range y
sprinkler reach ya se recuperaron y no se solicitan al jugador.

## P0

- Recipe output families: high-fan-out intermediates y una representative por template; inventario
  limpio, before/after, reload, tres repeticiones y vídeo. Una muestra no crea una regla global.
- Automation cycle/throughput: Furnace y production systems; power estable, batch controlado, timer,
  inputs/outputs y cinco repeticiones.
- Storage capacities: container vacío, un stackable type, llenar hasta rechazo, registrar slots y
  stack, reload y tres repeticiones.

## P1

Town compatibility: mismo unlock/materials y dos lugares válidos por town. Capturar town, surface y
error completo. Un fallo de terrain queda confounded, no incompatible.

## Formato

Usar `audit-data/iteration-5-1/measurement-template.json`:

```text
npm run measurement:validate -- path/to/measurement.json
```

El validador exige metric, subject, version nullable, value, unit, repetition, evidence, status,
timestamp, setup y conditions. Workflow: file → validation → candidate review → accepted → canonical
migration/projection. Validar no equivale a aceptar. Fichas completas:
`audit-data/iteration-5-1/measurement-queue.json`.

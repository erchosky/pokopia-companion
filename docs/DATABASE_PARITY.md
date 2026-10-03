# Database parity

## Iteration 4

The parity harness now compares Requests (5), Treasure Maps (6), Music CDs (53) and Ditto Moves
(14), plus representative nested values: the Map 6 quality warning, 10 Expansion Pass CDs and the
Water Gun/Soup boost. PostgreSQL imports 3,043 review-gated runtime projections. Evidence is written
to `audit-data/iteration-4/postgres-parity.json`.

## Contrato

`GameDataRepository` es el puerto único de aplicación. SQLite es el modo offline/revisión/test y PostgreSQL el runtime servidor de primera clase.

```dotenv
POKOPIA_DATA_BACKEND=sqlite
POKOPIA_DATABASE_PATH=./data/canonical/v3.1/pokopia-canonical.sqlite

# o
POKOPIA_DATA_BACKEND=postgres
POKOPIA_DATABASE_URL=postgresql://...
```

No hay fallback silencioso entre motores. Una configuración PostgreSQL incompleta falla con un mensaje explícito.

## Seed

El importador valida la SQLite antes de abrir una transacción. Inserta ejecución y records de staging, entidades tipadas, roles, recetas/ingredientes/outputs conocidos, niveles, búsqueda, assertions y evidencias. Sólo hace `COMMIT` tras comprobar conteos y ausencia de evidencias huérfanas; cualquier error ejecuta `ROLLBACK`.

Los IDs son deterministas y los upserts hacen el segundo seed idempotente. Las cantidades desconocidas no entran en columnas `NOT NULL`; permanecen en la assertion de procedencia.

## Resultado real

| Consulta principal       |                     SQLite | PostgreSQL | Resultado |
| ------------------------ | -------------------------: | ---------: | --------- |
| Pokémon                  |                        365 |        365 | PASS      |
| Items                    |                      1.700 |      1.700 | PASS      |
| Recetas                  |                        882 |        882 | PASS      |
| Pueblos                  |                          7 |          7 | PASS      |
| Automatización           |                         11 |         11 | PASS      |
| Portal Pod               |                 Portal pod | Portal pod | PASS      |
| Ingredientes Neo Dowsing | dowsing-machine, pokemetal |    iguales | PASS      |
| Palette Town max level   |                         10 |         10 | PASS      |

Evidencia: `audit-data/iteration-3.5/postgres-parity.json`.

## Seguridad operacional

- `db:seed:dry` no abre PostgreSQL.
- `db:seed` rechaza hosts no locales por defecto.
- No hay truncates, deletes masivos ni promoción automática a `accepted`.
- `DATABASE_URL` y claves permanecen server-only.
- Grants y RLS son controles distintos; las migraciones revocan defaults y habilitan políticas clasificadas.

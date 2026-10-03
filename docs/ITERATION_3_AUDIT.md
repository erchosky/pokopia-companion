# Auditoría técnica — Iteration 3

## Veredicto

Iteration 2 era funcional, pero tres supuestos impedían llamarla una capa inteligente: relaciones documentales tratables como si fueran grafo de juego, un parser de pueblos dependiente de posiciones de tabla y una personalización basada en checklist. Iteration 3 corrige esos límites sin reescribir arquitectura ni re-scrapear.

## Hallazgos por severidad

### P0 — corregidos

- **Town parser:** cinco de siete zonas mostraban recursos como Pokémon exclusivos. Evidencia: solo Palette Town y Cloud Island contienen la cabecera “List of Exclusive Pokémon”. Solución: detección semántica de cabeceras y regression fixture canonical. Resultado: 26 exclusivos reales, no 69.
- **Relationship semantics:** las 30.422 aristas SQLite son `links_to`. Solución: auditoría explícita y proyección tipada de 7.128 relaciones; no se promovió ninguna arista documental.
- **My Pokopia payload:** 294.054 bytes y 1.258 checks en baseline. Solución: dashboard de decisión; 29.289 bytes en dev local.

### P1 — corregidos

- Owned y resident se mezclaban en el pool del optimizer; ahora residencia es explícita por pueblo.
- Scoring no expresaba ganancia marginal ni banda de recomendación; V2 los separa.
- Automation no respondía “¿puedo construirlo?” en contexto de un pueblo; planner V2 muestra satisfied/missing/unknown y secuencia.
- Search respondía con coincidencias, no con intención; V3 añade rutas directas deterministas.
- Confidence usaba porcentajes sin calibración; la UI usa etiquetas humanas.
- El optimizer estaba debajo del catálogo largo; ahora está en la zona de decisión.

### P2 — parciales o abiertos

- Grafo cold build: 438 ms local, dentro del budget provisional de 500 ms pero debe validarse en deployment.
- Palette Town: ~171 KB en dev, bajo budget provisional de 200 KB pero mayor que baseline.
- No hay cantidades de inventario; readiness es orientativo.
- No hay sync remota: estado V3 sigue local-first y aislado por navegador.

## Invariantes de datos

- SQLite `integrity_check=ok`, foreign keys sin errores y sin WAL/SHM en el artefacto.
- 2.532/2.532 páginas, 12.183 tablas, 13.068 facts, 2.593 entidades y 30.422 links documentales.
- Encoding 48 señales de mojibake antes, 0 después; U+FFFD 0.
- 365 Pokémon, 1.700 items, 882 recipes; 880 con cantidades completas.
- 7 zonas, 524 unlocks, 26 Pokémon exclusivos, 101 recursos de zona, 552 plantas/bloques y 775 facilities listadas.

## Seguridad

- RLS está habilitado en todas las tablas expuestas y se valida dinámicamente en PostgreSQL.
- Grants y policies son capas separadas; `anon` no recibe user/admin writes.
- User rows usan subject JWT y `USING`+`WITH CHECK`; roles administrativos leen `app_metadata`, no metadata editable.
- No existe service/secret key en cliente ni en `.env.example`; solo URL y publishable key.
- El diseño portable usa policies `TO PUBLIC` pero object grants restringen alcance. En un target Supabase-only se puede estrechar `TO anon, authenticated` como hardening de performance.

Referencias verificadas: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api), [API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Resultado

Los gates y resultados finales se registran en `ITERATION_3_REPORT.md`. Ningún test fue deshabilitado.

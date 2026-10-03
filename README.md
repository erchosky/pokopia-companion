# Pokopia Companion

Mi compañero para **Pokémon Pokopia**: consultar Pokémon, objetos, recetas y pueblos, buscar lo que necesitas, planificar y guardar el progreso. Para tener las cosas a mano sin acabar con cuarenta pestañas abiertas, sabeehh.

Los datos conservan su fuente y su versión, y las recomendaciones explican por qué salen. Por dentro hay una base del juego, un proceso reproducible para transformar los datos y una app separada para revisar su calidad.

La base local V3.1 y el primer conjunto de funciones de producto están terminados. Para retomar el proyecto, empieza por [el plan de ejecución](docs/EXECUTION_PLAN.md), [la arquitectura](docs/ARCHITECTURE.md), [la auditoría de datos](docs/DATA_AUDIT.md) y [la revisión de interfaz y experiencia](docs/UX_UI_AUDIT.md).

## De dónde salen los datos

La copia privada de investigación de Serebii no se sube a Git ni se publica. La aplicación usa hechos estructurados derivados y textos propios: no muestra la copia de la web ni enlaza directamente sus recursos gráficos.

## Qué está hecho en local

- Procesamiento reproducible de las **2.532 páginas capturadas** de la V3.1 en una base SQLite canónica y archivos JSONL que conservan la procedencia de los datos.
- Modelo de dominio en PostgreSQL con versiones, contratos de promoción que exigen revisión, permisos explícitos y migraciones RLS.
- Web con Next.js pensada primero para móvil: búsqueda con datos reales, Pokédex, objetos, recetas, pueblos, recomendaciones explicadas y progreso privado local.
- App de administración separada para revisar fuentes, entidades, huecos y calidad de los datos. Si falta la configuración necesaria, el acceso queda cerrado.

La base local con datos está en `data/canonical/v3.1/pokopia-canonical.sqlite`. Configura `POKOPIA_DATABASE_PATH` solo si quieres usar otra ruta.

## Cómo arrancarlo

```bash
npm install
npm run data:process
npm run data:validate
npm run dev             # web: http://localhost:3000
npm run dev:admin       # administración: http://localhost:3001
```

Antes de abrir la administración, copia `.env.example` a `.env.local` y configura sus dos secretos exclusivos. Sin ellos, la app de administración bloquea el acceso.

## Comprobar datos y aplicación

```bash
npm run data:verify-source
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:postgres --workspace @pokopia/db
npm run build
npm run test:e2e
```

La prueba de PostgreSQL usa una instancia local temporal de PostgreSQL 16. Aplicar las migraciones en Supabase, promover los datos revisados al PostgreSQL alojado y desplegar en Vercel requiere las credenciales del proyecto; la compilación local no hace esos pasos. Los secretos se quedan fuera de Git.

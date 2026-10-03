# Búsqueda

La aplicación consume `SearchEngine`, no SQL. El adapter legacy ejecuta FTS5 Unicode sobre `chunks_fts`, deduplica por URL y devuelve tipo, slug, extracto y rango. `POKOPIA_DATABASE_PATH` permite sustituir la fuente sin cambiar las páginas.

La capa normaliza Unicode NFKC, espacios y filtros por clase de entidad. El diccionario de sinónimos es explícito y auditable; no se usa un modelo generativo para búsquedas normales.

La implementación PostgreSQL debe conservar el contrato e incorporar `tsvector`, `websearch_to_tsquery`, `pg_trgm`, aliases y synonyms canónicos. Semantic search será un proveedor opcional posterior, nunca la única vía de recuperación.

Limitación actual: la SQLite legacy indexa chunks de documentos, no entidades canónicas; por eso todos los resultados se presentan con procedencia y estado sin revisar.

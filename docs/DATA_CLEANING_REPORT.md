# Informe de limpieza V3.1

Generado: 2026-08-12T00:16:16.990Z

## Resultado

Se reprocesaron 2532 de 2532 páginas indexadas desde RAW_HTML. La verificación encontró 0 páginas sin metadatos, 0 hashes distintos al índice y 0 URLs fuente duplicadas.

La salida tiene 0 caracteres U+FFFD, 0 patrones de mojibake y 0 páginas con marcadores conocidos de navegación/footer dentro del contenido extraído. No se aceptan silenciosamente páginas cortas: 51 quedaron marcadas `short` y se enumeran en `data/audits/v3.1/audit.json`.

## Transformaciones aplicadas

1. Lectura binaria y SHA-256 sobre cada RAW original.
2. Detección UTF-8/Windows-1252 con charset HTML y puntuación de corrupción.
3. Reparación local conservadora de secuencias UTF-8 interpretadas como Windows-1252 (por ejemplo, `Ã©`, `â€™`, `â€¦`), registrando recuentos antes/después.
4. Selección de `main` (fallback `#content`/`body`) y eliminación de scripts, estilos, formularios y contenedores publicitarios conocidos.
5. Normalización de espacios sin transliterar Unicode.
6. Conservación de enlaces internos relevantes, tablas, spans, imágenes y coordenadas fila/columna.
7. Hechos sólo desde pares key/value explícitos; relaciones sólo desde enlaces HTML explícitos.
8. Chunks RAG de hasta 2.000 caracteres con solape y procedencia completa.
9. Escritura de JSON/JSONL/Markdown y SQLite en carpetas derivadas ignoradas por Git.

## Controles

- Fingerprint del conjunto RAW: `6baa001138c5758e693b7a6e20ec69bae0749ad46ec1c3551056c0a9d01c62cd`.
- Integridad SQLite original: `ok`.
- Tablas vacías sospechosas: 2.
- Entidades huérfanas: 18 (una entidad documental sin enlace puede seguir siendo válida; no se elimina).
- URLs fuente inválidas: 0.
- Referencias internas no presentes en el snapshot: 61.
- Assets de tablas no resueltos localmente: 146.

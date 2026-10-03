# Fuentes y procedencia

## Snapshot maestro

La fuente primaria de este repositorio es el snapshot privado e inmutable:

`data/source/snapshots/20260809/Pokopia-KB-FULL`

Su contenido procede de la sección Pokémon Pokopia de Serebii y fue capturado entre las fechas registradas en `00_INDEX/MASTER_INDEX.json`. Serebii es una fuente comunitaria, no una fuente oficial del juego.

## Jerarquía de uso

1. `RAW_HTML`: autoridad local para reprocesar texto, tablas, enlaces y referencias a assets.
2. `00_INDEX/MASTER_INDEX.json` y `SOURCES.json`: URL, fecha, hash y resultado de captura.
3. `TABLES`, `STRUCTURED` y SQLite legado: evidencia auxiliar para comparar cobertura y detectar regresiones.
4. `MARKDOWN` y `RAG` legados: no canónicos debido al mojibake y ruido de navegación observados.
5. `OFFLINE_SITE`: copia de consulta y assets; no sustituye el RAW como fuente de extracción.

## Confianza

- La presencia de un valor en el HTML prueba qué publicó la fuente en la fecha del snapshot, no necesariamente que el dato sea correcto en el juego.
- Los registros V3.1 conservan `sourceUrl`, `sourceHash`, `fetchedAt` y `parserVersion`.
- `fact` describe contenido explícito; `links_to` describe un enlace documental. Ninguno debe reinterpretarse automáticamente como inferencia, recomendación o estado del usuario.
- Para marcar información como `official` o `confirmed` hace falta una fuente oficial o verificación independiente. En caso contrario debe permanecer `community_confirmed`, `unverified`, `unknown` o `needs_testing` según corresponda en la futura capa de revisión.

## Licencia y uso

El snapshot es material de investigación privado. No se versiona en Git y no debe publicarse o redistribuirse sin revisar derechos, términos de uso y atribución. La aplicación debe enlazar la URL fuente cuando exponga datos procedentes de Serebii.

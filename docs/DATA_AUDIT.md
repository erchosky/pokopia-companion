# Auditoría de datos

Generada: 2026-08-12T00:16:16.990Z  
Snapshot: `data/source/snapshots/20260809/Pokopia-KB-FULL`  
Fingerprint inmutable RAW: `6baa001138c5758e693b7a6e20ec69bae0749ad46ec1c3551056c0a9d01c62cd`  
Parser: `3.1.0`

## Veredicto

El snapshot contiene **2532 páginas RAW HTML** y es utilizable como fuente primaria local. El reprocesado V3.1 decodificó 2532 páginas como Windows-1252 y 0 como UTF-8; la elección se hizo por declaración HTML cuando existe y puntuación de U+FFFD, mojibake y controles. Como algunos HTML mezclan Windows-1252 con secuencias UTF-8 embebidas, se aplicó reparación conservadora por secuencia (no una reconversión global): de 48 señales conocidas antes de reparar a **0** después. Las salidas limpias contienen **0 U+FFFD**.

TABLES y STRUCTURED son evidencias auxiliares útiles, no la autoridad canónica: la reconstrucción actual parte de RAW_HTML. El SQLite original pasó `ok` y tiene 2532 páginas, pero conserva el contenido RAG/Markdown con defectos conocidos y no debe copiarse a producción sin reprocesar.

La selección V3.1 conserva los mismos 12.183 índices de tabla que TABLES, pero vuelve a leer las celdas desde RAW_HTML. Sus 57.704 filas no buscan paridad con las 66.297 filas legadas: V3.1 asigna cada `tr` a su tabla propietaria y evita contar de nuevo las filas de tablas anidadas dentro de la tabla exterior.

## Inventario comprobado

| Componente                     |                        Resultado |
| ------------------------------ | -------------------------------: |
| RAW HTML procesado             | 2532 páginas / 379.301.412 bytes |
| Markdown legado                |                    2532 ficheros |
| TABLES legado                  |                    2532 ficheros |
| RAG legado                     |                  3373 documentos |
| Facts legados                  |                           13.701 |
| Filas estructuradas legadas    |                           66.297 |
| Assets declarados por V3       |                           17.841 |
| Errores registrados en captura |                              202 |

## Resultado V3.1

| Métrica                                       |                Valor |
| --------------------------------------------- | -------------------: |
| Texto extraído                                | 2.377.415 caracteres |
| Markdown limpio                               | 3.011.004 caracteres |
| Tablas / filas                                |      12.183 / 57.704 |
| Tablas vacías sospechosas                     |                    2 |
| Facts conservadores (filas key/value)         |               13.068 |
| Entidades documentales/enlazadas              |                 2593 |
| Relaciones trazables `links_to`               |               30.422 |
| Chunks RAG                                    |                 3308 |
| Páginas demasiado cortas                      |                   51 |
| Páginas con ruido residual                    |                    0 |
| Grupos duplicados exactos                     |                    0 |
| Parejas candidatas por similitud SimHash      |                 1326 |
| URLs internas sin snapshot                    |                   61 |
| Assets referenciados en tablas / sin resolver |         17.758 / 146 |

## Fiabilidad y límites

- **Alta:** bytes RAW, URL, SHA-256, fecha de captura, texto dentro de `main`, celdas y enlaces explícitos en HTML.
- **Media:** hechos key/value: sólo se emiten para filas con exactamente dos valores no vacíos, conservando tabla, fila y URL.
- **Baja o pendiente de modelado:** el tipo de entidad inferido desde la ruta y la relación `links_to` describen estructura documental; no prueban por sí solas una relación del juego.
- Los 202 errores son errores históricos de la captura (principalmente respuestas de descarga); V3.1 no vuelve a descargar el sitio.
- Las 1326 parejas SimHash son **candidatos de similitud para revisión**, no duplicados confirmados. Páginas de items/hábitats comparten plantillas y pueden ser legítimamente parecidas.
- Las afirmaciones de Serebii siguen siendo fuente comunitaria. Mecánicas, cifras ambiguas y contenido de versión necesitan contraste oficial o prueba en juego antes de marcarse como confirmadas.

## Duplicados y extracción sospechosa

Duplicados exactos: ninguno.

Páginas cortas (muestra):

- `https://www.serebii.net/pokemonpokopia/pics.shtml (129 chars; 0 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/articuno.shtml (253 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/ditto.shtml (210 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/entei.shtml (248 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/ho-oh.shtml (260 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/kyogre.shtml (257 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/lugia.shtml (257 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/moltres.shtml (247 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/raikou.shtml (259 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/appraise.shtml (225 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/collect.shtml (223 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/dj.shtml (167 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/dreamisland.shtml (209 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/eat.shtml (185 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/engineer.shtml (255 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/gatherhoney.shtml (237 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/illuminate.shtml (204 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/paint.shtml (195 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/rarify.shtml (191 chars; 2 tablas)`
- `https://www.serebii.net/pokemonpokopia/pokedex/specialty/storage.shtml (205 chars; 2 tablas)`

Ruido residual (muestra):

- Ninguno.

## Cobertura por categoría

| Categoría     | Páginas |
| ------------- | ------: |
| items         |    1701 |
| pokedex       |     409 |
| habitatdex    |     250 |
| build         |      56 |
| favorites     |      44 |
| general       |      39 |
| locations     |       8 |
| events        |       7 |
| dreamisland   |       6 |
| pokemon       |       3 |
| abilities     |       1 |
| building      |       1 |
| cloud-islands |       1 |
| crafting      |       1 |
| dream-islands |       1 |
| expansionpass |       1 |
| furniture     |       1 |
| requests      |       1 |
| treasure-maps |       1 |

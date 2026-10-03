import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuditReport } from './types.js';

const number = new Intl.NumberFormat('es-ES');
const n = (value: number): string => number.format(value);
const sample = (values: readonly string[], limit = 20): string =>
  values.length === 0
    ? '- Ninguno.'
    : values
        .slice(0, limit)
        .map((value) => `- \`${value}\``)
        .join('\n');

export async function writeReports(docs: string, audit: AuditReport): Promise<void> {
  const auditDocument = `# Auditoría de datos

Generada: ${audit.generatedAt}  
Snapshot: \`${audit.snapshotRoot}\`  
Fingerprint inmutable RAW: \`${audit.snapshotFingerprint}\`  
Parser: \`${audit.parserVersion}\`

## Veredicto

El snapshot contiene **${n(audit.pages)} páginas RAW HTML** y es utilizable como fuente primaria local. El reprocesado V3.1 decodificó ${n(audit.encodings['windows-1252'])} páginas como Windows-1252 y ${n(audit.encodings['utf-8'])} como UTF-8; la elección se hizo por declaración HTML cuando existe y puntuación de U+FFFD, mojibake y controles. Como algunos HTML mezclan Windows-1252 con secuencias UTF-8 embebidas, se aplicó reparación conservadora por secuencia (no una reconversión global): de ${n(audit.encodingRepairs.mojibakeSignalsBeforeRepair)} señales conocidas antes de reparar a **${n(audit.mojibakeSignals)}** después. Las salidas limpias contienen **${n(audit.replacementCharacters)} U+FFFD**.

TABLES y STRUCTURED son evidencias auxiliares útiles, no la autoridad canónica: la reconstrucción actual parte de RAW_HTML. El SQLite original pasó \`${audit.originalDataset.sqliteIntegrity}\` y tiene ${n(audit.originalDataset.sqlitePages)} páginas, pero conserva el contenido RAG/Markdown con defectos conocidos y no debe copiarse a producción sin reprocesar.

La selección V3.1 conserva los mismos ${n(audit.tables)} índices de tabla que TABLES, pero vuelve a leer las celdas desde RAW_HTML. Sus ${n(audit.tableRows)} filas no buscan paridad con las ${n(audit.originalDataset.structuredTableRows)} filas legadas: V3.1 asigna cada \`tr\` a su tabla propietaria y evita contar de nuevo las filas de tablas anidadas dentro de la tabla exterior.

## Inventario comprobado

| Componente | Resultado |
| --- | ---: |
| RAW HTML procesado | ${n(audit.pages)} páginas / ${n(audit.sourceBytes)} bytes |
| Markdown legado | ${n(audit.originalDataset.markdownFiles)} ficheros |
| TABLES legado | ${n(audit.originalDataset.tableFiles)} ficheros |
| RAG legado | ${n(audit.originalDataset.ragDocuments)} documentos |
| Facts legados | ${n(audit.originalDataset.structuredFacts)} |
| Filas estructuradas legadas | ${n(audit.originalDataset.structuredTableRows)} |
| Assets declarados por V3 | ${n(audit.originalDataset.indexedAssets)} |
| Errores registrados en captura | ${n(audit.originalDataset.sourceErrors)} |

## Resultado V3.1

| Métrica | Valor |
| --- | ---: |
| Texto extraído | ${n(audit.extractedCharacters)} caracteres |
| Markdown limpio | ${n(audit.markdownCharacters)} caracteres |
| Tablas / filas | ${n(audit.tables)} / ${n(audit.tableRows)} |
| Tablas vacías sospechosas | ${n(audit.emptyTables)} |
| Facts conservadores (filas key/value) | ${n(audit.facts)} |
| Entidades documentales/enlazadas | ${n(audit.entities)} |
| Relaciones trazables \`links_to\` | ${n(audit.relationships)} |
| Chunks RAG | ${n(audit.ragChunks)} |
| Páginas demasiado cortas | ${n(audit.shortPages.length)} |
| Páginas con ruido residual | ${n(audit.noisyPages.length)} |
| Grupos duplicados exactos | ${n(audit.exactDuplicateGroups.length)} |
| Parejas candidatas por similitud SimHash | ${n(audit.nearDuplicateGroups.length)} |
| URLs internas sin snapshot | ${n(audit.unresolvedInternalLinks.length)} |
| Assets referenciados en tablas / sin resolver | ${n(audit.referencedAssets)} / ${n(audit.unresolvedReferencedAssets.length)} |

## Fiabilidad y límites

- **Alta:** bytes RAW, URL, SHA-256, fecha de captura, texto dentro de \`main\`, celdas y enlaces explícitos en HTML.
- **Media:** hechos key/value: sólo se emiten para filas con exactamente dos valores no vacíos, conservando tabla, fila y URL.
- **Baja o pendiente de modelado:** el tipo de entidad inferido desde la ruta y la relación \`links_to\` describen estructura documental; no prueban por sí solas una relación del juego.
- Los ${n(audit.originalDataset.sourceErrors)} errores son errores históricos de la captura (principalmente respuestas de descarga); V3.1 no vuelve a descargar el sitio.
- Las ${n(audit.nearDuplicateGroups.length)} parejas SimHash son **candidatos de similitud para revisión**, no duplicados confirmados. Páginas de items/hábitats comparten plantillas y pueden ser legítimamente parecidas.
- Las afirmaciones de Serebii siguen siendo fuente comunitaria. Mecánicas, cifras ambiguas y contenido de versión necesitan contraste oficial o prueba en juego antes de marcarse como confirmadas.

## Duplicados y extracción sospechosa

Duplicados exactos: ${
    audit.exactDuplicateGroups.length === 0
      ? 'ninguno'
      : audit.exactDuplicateGroups
          .slice(0, 10)
          .map((group) => `\n- ${group.map((url) => `\`${url}\``).join(', ')}`)
          .join('')
  }.

Páginas cortas (muestra):

${sample(audit.shortPages.map((page) => `${page.url} (${page.extractedChars} chars; ${page.tables} tablas)`))}

Ruido residual (muestra):

${sample(audit.noisyPages.map((page) => `${page.url}: ${page.signals.join(', ')}`))}

## Cobertura por categoría

| Categoría | Páginas |
| --- | ---: |
${Object.entries(audit.categories)
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => `| ${category} | ${n(count)} |`)
  .join('\n')}
`;

  const cleaningDocument = `# Informe de limpieza V3.1

Generado: ${audit.generatedAt}

## Resultado

Se reprocesaron ${n(audit.pages)} de ${n(audit.sourceMetadata.indexedPages)} páginas indexadas desde RAW_HTML. La verificación encontró ${n(audit.sourceMetadata.missingMetadata)} páginas sin metadatos, ${n(audit.sourceMetadata.hashMismatches)} hashes distintos al índice y ${n(audit.sourceMetadata.duplicateSourceUrls)} URLs fuente duplicadas.

La salida tiene ${n(audit.replacementCharacters)} caracteres U+FFFD, ${n(audit.mojibakeSignals)} patrones de mojibake y ${n(audit.noisyPages.length)} páginas con marcadores conocidos de navegación/footer dentro del contenido extraído. No se aceptan silenciosamente páginas cortas: ${n(audit.shortPages.length)} quedaron marcadas \`short\` y se enumeran en \`data/audits/v3.1/audit.json\`.

## Transformaciones aplicadas

1. Lectura binaria y SHA-256 sobre cada RAW original.
2. Detección UTF-8/Windows-1252 con charset HTML y puntuación de corrupción.
3. Reparación local conservadora de secuencias UTF-8 interpretadas como Windows-1252 (por ejemplo, \`Ã©\`, \`â€™\`, \`â€¦\`), registrando recuentos antes/después.
4. Selección de \`main\` (fallback \`#content\`/\`body\`) y eliminación de scripts, estilos, formularios y contenedores publicitarios conocidos.
5. Normalización de espacios sin transliterar Unicode.
6. Conservación de enlaces internos relevantes, tablas, spans, imágenes y coordenadas fila/columna.
7. Hechos sólo desde pares key/value explícitos; relaciones sólo desde enlaces HTML explícitos.
8. Chunks RAG de hasta 2.000 caracteres con solape y procedencia completa.
9. Escritura de JSON/JSONL/Markdown y SQLite en carpetas derivadas ignoradas por Git.

## Controles

- Fingerprint del conjunto RAW: \`${audit.snapshotFingerprint}\`.
- Integridad SQLite original: \`${audit.originalDataset.sqliteIntegrity}\`.
- Tablas vacías sospechosas: ${n(audit.emptyTables)}.
- Entidades huérfanas: ${n(audit.orphanEntityIds.length)} (una entidad documental sin enlace puede seguir siendo válida; no se elimina).
- URLs fuente inválidas: ${n(audit.invalidSourceUrls.length)}.
- Referencias internas no presentes en el snapshot: ${n(audit.unresolvedInternalLinks.length)}.
- Assets de tablas no resueltos localmente: ${n(audit.unresolvedReferencedAssets.length)}.
`;

  const gapsDocument = `# Gaps de datos

Generado: ${audit.generatedAt}

## Bloqueos y huecos observados

- Hay ${n(audit.sourceErrors.length)} errores registrados durante la captura original. No se reintentaron para respetar el pipeline local y el snapshot inmutable.
- ${n(audit.unresolvedInternalLinks.length)} enlaces internos relevantes no tienen página fuente equivalente en este snapshot. Pueden ser páginas fuera del alcance Pokopia, errores históricos o contenido ausente; requieren revisión, no relleno inventado.
- ${n(audit.unresolvedReferencedAssets.length)} assets referenciados desde tablas no se resolvieron en las rutas offline esperadas.
- ${n(audit.shortPages.length)} páginas tienen extracción corta y requieren inspección antes de promover sus datos.
- ${n(audit.emptyTables)} tablas están vacías o sin texto. Una tabla basada sólo en imagen puede ser legítima, por lo que se marca y no se descarta.
- ${n(audit.orphanEntityIds.length)} entidades no participan en una relación. Esto incluye documentos sin links útiles y no implica automáticamente un error.
- La versión de juego no está expresada de forma uniforme en el HTML. V3.1 conserva fecha/hash/fuente, pero no inventa \`introduced_version\` ni \`removed_version\`.
- Los tipos de dominio (Pokémon, receta, habilidad, ubicación, condición de desbloqueo) necesitan parsers especializados y revisión humana antes de promoción. Esta pasada produce staging documental trazable, no afirmaciones canónicas validadas.

## Muestras para revisión

Enlaces internos sin snapshot:

${sample(audit.unresolvedInternalLinks)}

Assets no resueltos:

${sample(audit.unresolvedReferencedAssets)}

Errores de captura:

${sample(audit.sourceErrors.map((error) => `${error.url} — ${error.stage}: ${error.error}`))}
`;

  await Promise.all([
    writeFile(join(docs, 'DATA_AUDIT.md'), auditDocument, 'utf8'),
    writeFile(join(docs, 'DATA_CLEANING_REPORT.md'), cleaningDocument, 'utf8'),
    writeFile(join(docs, 'DATA_GAPS.md'), gapsDocument, 'utf8'),
  ]);
}

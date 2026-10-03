import type {
  EntityRecord,
  ExtractedTable,
  FactRecord,
  LinkRecord,
  RagChunk,
  RelationshipRecord,
} from './types.js';
import { normalizeWhitespace, stableId } from './util.js';

function entityTypeFromUrl(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return 'page';
  const folder = segments.at(-2);
  if (folder !== undefined && folder !== 'pokemonpokopia')
    return folder.replace(/[^a-z0-9_]+/gi, '_');
  return 'page';
}

function nameFromLink(link: LinkRecord): string {
  const cleaned = normalizeWhitespace(link.text).replace(/^[-–—]\s*/, '');
  if (cleaned !== '') return cleaned;
  return decodeURIComponent(
    new URL(link.url).pathname
      .split('/')
      .filter(Boolean)
      .at(-1)
      ?.replace(/\.shtml$/, '') ?? link.url,
  );
}

export function deriveKnowledge(
  sourceUrl: string,
  title: string,
  links: LinkRecord[],
  tables: ExtractedTable[],
): {
  entities: EntityRecord[];
  relationships: RelationshipRecord[];
  facts: FactRecord[];
} {
  const pageEntityId = stableId('ent', sourceUrl);
  const entitiesById = new Map<string, EntityRecord>();
  entitiesById.set(pageEntityId, {
    id: pageEntityId,
    type: entityTypeFromUrl(sourceUrl),
    name: title,
    sourceUrl,
    sourceKind: 'page',
  });
  const relationships: RelationshipRecord[] = [];
  for (const link of links) {
    const targetEntityId = stableId('ent', link.url);
    if (targetEntityId !== pageEntityId) {
      entitiesById.set(targetEntityId, {
        id: targetEntityId,
        type: entityTypeFromUrl(link.url),
        name: nameFromLink(link),
        sourceUrl: link.url,
        sourceKind: 'linked_page',
      });
    }
    relationships.push({
      id: stableId('rel', `${sourceUrl}|links_to|${link.url}`),
      sourceEntityId: pageEntityId,
      targetEntityId,
      type: 'links_to',
      sourceUrl,
    });
  }
  const facts: FactRecord[] = [];
  for (const table of tables) {
    for (const row of table.rows) {
      const values = row.cells.map((cell) => cell.text).filter((value) => value !== '');
      if (values.length !== 2) continue;
      const [key, value] = values;
      if (
        key === undefined ||
        value === undefined ||
        key === value ||
        key.length > 160 ||
        value.length > 2_000
      )
        continue;
      facts.push({
        id: stableId('fact', `${sourceUrl}|${table.tableIndex}|${row.rowIndex}|${key}|${value}`),
        entityId: pageEntityId,
        key,
        value,
        tableIndex: table.tableIndex,
        rowIndex: row.rowIndex,
        sourceUrl,
      });
    }
  }
  return { entities: [...entitiesById.values()], relationships, facts };
}

export function mergeEntities(values: readonly EntityRecord[]): EntityRecord[] {
  const entities = new Map<string, EntityRecord>();
  for (const entity of values) {
    const existing = entities.get(entity.id);
    if (existing === undefined || entity.sourceKind === 'page' || existing.sourceKind !== 'page') {
      entities.set(entity.id, entity);
    }
  }
  return [...entities.values()];
}

export function chunkMarkdown(
  sourceUrl: string,
  title: string,
  category: string,
  markdown: string,
  sourceHash: string,
  parserVersion: string,
): RagChunk[] {
  const maxChars = 2_000;
  const overlap = 200;
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (current !== '' && current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current);
      current = `${current.slice(-overlap)}\n\n${paragraph}`;
    } else {
      current = current === '' ? paragraph : `${current}\n\n${paragraph}`;
    }
    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars - overlap);
    }
  }
  if (current !== '') chunks.push(current);
  return chunks.map((text, chunkIndex) => ({
    id: stableId('rag', `${sourceUrl}|${chunkIndex}|${sourceHash}|${parserVersion}`),
    sourceUrl,
    title,
    category,
    chunkIndex,
    text,
    sourceHash,
    parserVersion,
  }));
}

import { unlink } from 'node:fs/promises';
import Database from 'better-sqlite3';
import { mergeEntities } from './derive.js';
import type {
  FactRecord,
  ProcessedPage,
  QuantitativeAssertion,
  RagChunk,
  RelationshipRecord,
} from './types.js';

function uniqueById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

export async function writeCanonicalSqlite(
  path: string,
  pages: readonly ProcessedPage[],
  ragChunks: readonly RagChunk[],
): Promise<void> {
  await unlink(path).catch((error: unknown) => {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  });
  const database = new Database(path);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE pages (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      source_path TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      fetched_at TEXT,
      processed_at TEXT NOT NULL,
      parser_version TEXT NOT NULL,
      encoding TEXT NOT NULL,
      text TEXT NOT NULL,
      markdown TEXT NOT NULL,
      extraction_quality TEXT NOT NULL
    ) STRICT;
    CREATE TABLE links (
      source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      target_url TEXT NOT NULL,
      label TEXT NOT NULL,
      internal INTEGER NOT NULL CHECK (internal IN (0, 1)),
      PRIMARY KEY (source_page_id, target_url)
    ) STRICT;
    CREATE TABLE page_tables (
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      table_index INTEGER NOT NULL,
      caption TEXT NOT NULL,
      PRIMARY KEY (page_id, table_index)
    ) STRICT;
    CREATE TABLE table_cells (
      page_id TEXT NOT NULL,
      table_index INTEGER NOT NULL,
      row_index INTEGER NOT NULL,
      column_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      is_header INTEGER NOT NULL CHECK (is_header IN (0, 1)),
      colspan INTEGER NOT NULL,
      rowspan INTEGER NOT NULL,
      links_json TEXT NOT NULL,
      images_json TEXT NOT NULL,
      PRIMARY KEY (page_id, table_index, row_index, column_index),
      FOREIGN KEY (page_id, table_index) REFERENCES page_tables(page_id, table_index) ON DELETE CASCADE
    ) STRICT;
    CREATE TABLE entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_kind TEXT NOT NULL
    ) STRICT;
    CREATE TABLE relationships (
      id TEXT PRIMARY KEY,
      source_entity_id TEXT NOT NULL REFERENCES entities(id),
      target_entity_id TEXT NOT NULL REFERENCES entities(id),
      type TEXT NOT NULL,
      source_url TEXT NOT NULL
    ) STRICT;
    CREATE TABLE facts (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL REFERENCES entities(id),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      table_index INTEGER NOT NULL,
      row_index INTEGER NOT NULL,
      source_url TEXT NOT NULL
    ) STRICT;
    CREATE TABLE quantitative_assertions (
      id TEXT PRIMARY KEY,
      subject_kind TEXT NOT NULL,
      subject_slug TEXT NOT NULL,
      predicate TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      qualifier TEXT,
      derivation TEXT NOT NULL CHECK (derivation IN ('source_fact', 'mathematical_derived')),
      parent_assertion_ids_json TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      locator TEXT NOT NULL,
      evidence_text TEXT NOT NULL,
      parser_id TEXT NOT NULL,
      parser_confidence REAL NOT NULL CHECK (parser_confidence BETWEEN 0 AND 1),
      evidence_confidence REAL NOT NULL CHECK (evidence_confidence BETWEEN 0 AND 1),
      source_verification_status TEXT NOT NULL CHECK (source_verification_status IN ('unverified', 'confirmed')),
      assertion_status TEXT NOT NULL CHECK (assertion_status IN ('accepted', 'candidate', 'disputed')),
      content_scope TEXT NOT NULL CHECK (content_scope IN ('base_game', 'expansion', 'unknown')),
      game_version TEXT
    ) STRICT;
    CREATE TABLE rag_chunks (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      parser_version TEXT NOT NULL
    ) STRICT;
    CREATE VIRTUAL TABLE rag_fts USING fts5(id UNINDEXED, title, category, text, tokenize='unicode61');
    CREATE INDEX pages_category_idx ON pages(category);
    CREATE INDEX facts_entity_idx ON facts(entity_id);
    CREATE INDEX facts_source_idx ON facts(source_url, table_index, row_index);
    CREATE INDEX quantitative_subject_idx ON quantitative_assertions(subject_kind, subject_slug);
    CREATE INDEX quantitative_status_idx ON quantitative_assertions(assertion_status, predicate);
    CREATE INDEX relationships_source_idx ON relationships(source_entity_id);
    CREATE INDEX relationships_target_idx ON relationships(target_entity_id);
  `);
  const insertPage = database.prepare(
    'INSERT INTO pages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const insertLink = database.prepare('INSERT INTO links VALUES (?, ?, ?, ?)');
  const insertTable = database.prepare('INSERT INTO page_tables VALUES (?, ?, ?)');
  const insertCell = database.prepare(
    'INSERT INTO table_cells VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const insertEntity = database.prepare('INSERT INTO entities VALUES (?, ?, ?, ?, ?)');
  const insertRelationship = database.prepare('INSERT INTO relationships VALUES (?, ?, ?, ?, ?)');
  const insertFact = database.prepare('INSERT INTO facts VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertQuantitative = database.prepare(
    'INSERT INTO quantitative_assertions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const insertRag = database.prepare('INSERT INTO rag_chunks VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertFts = database.prepare('INSERT INTO rag_fts VALUES (?, ?, ?, ?)');
  const entities = mergeEntities(pages.flatMap((page) => page.entities));
  const relationships = uniqueById<RelationshipRecord>(pages.flatMap((page) => page.relationships));
  const facts = uniqueById<FactRecord>(pages.flatMap((page) => page.facts));
  const quantitativeAssertions = uniqueById<QuantitativeAssertion>(
    pages.flatMap((page) => page.quantitativeAssertions),
  );
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const page of pages) {
      insertPage.run(
        page.id,
        page.sourceUrl,
        page.title,
        page.category,
        page.sourcePath,
        page.sourceHash,
        page.fetchedAt,
        page.processedAt,
        page.parserVersion,
        page.encoding,
        page.text,
        page.markdown,
        page.extractionQuality,
      );
      for (const link of page.links)
        insertLink.run(page.id, link.url, link.text, link.internal ? 1 : 0);
      for (const table of page.tables) {
        insertTable.run(page.id, table.tableIndex, table.caption);
        for (const row of table.rows)
          for (const cell of row.cells) {
            insertCell.run(
              page.id,
              table.tableIndex,
              row.rowIndex,
              cell.columnIndex,
              cell.text,
              cell.isHeader ? 1 : 0,
              cell.colspan,
              cell.rowspan,
              JSON.stringify(cell.links),
              JSON.stringify(cell.images),
            );
          }
      }
    }
    for (const entity of entities)
      insertEntity.run(entity.id, entity.type, entity.name, entity.sourceUrl, entity.sourceKind);
    for (const relationship of relationships)
      insertRelationship.run(
        relationship.id,
        relationship.sourceEntityId,
        relationship.targetEntityId,
        relationship.type,
        relationship.sourceUrl,
      );
    for (const fact of facts)
      insertFact.run(
        fact.id,
        fact.entityId,
        fact.key,
        fact.value,
        fact.tableIndex,
        fact.rowIndex,
        fact.sourceUrl,
      );
    for (const assertion of quantitativeAssertions)
      insertQuantitative.run(
        assertion.id,
        assertion.subjectKind,
        assertion.subjectSlug,
        assertion.predicate,
        assertion.value,
        assertion.unit,
        assertion.qualifier,
        assertion.derivation,
        JSON.stringify(assertion.parentAssertionIds),
        assertion.sourceUrl,
        assertion.sourceHash,
        assertion.locator,
        assertion.evidenceText,
        assertion.parserId,
        assertion.parserConfidence,
        assertion.evidenceConfidence,
        assertion.sourceVerificationStatus,
        assertion.assertionStatus,
        assertion.contentScope,
        assertion.gameVersion,
      );
    for (const chunk of ragChunks) {
      insertRag.run(
        chunk.id,
        chunk.sourceUrl,
        chunk.title,
        chunk.category,
        chunk.chunkIndex,
        chunk.text,
        chunk.sourceHash,
        chunk.parserVersion,
      );
      insertFts.run(chunk.id, chunk.title, chunk.category, chunk.text);
    }
    database.exec('COMMIT');
    database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    database.exec('PRAGMA journal_mode = DELETE');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

export function inspectLegacySqlite(path: string): { pages: number; integrity: string } {
  const database = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const pages = database.prepare('SELECT COUNT(*) AS count FROM pages').get() as {
      count: number;
    };
    const integrity = database.prepare('PRAGMA integrity_check').get() as {
      integrity_check: string;
    };
    return { pages: pages.count, integrity: integrity.integrity_check };
  } finally {
    database.close();
  }
}

import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { AuditReport } from './types.js';
import type { PipelinePaths } from './paths.js';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function validatePipeline(paths: PipelinePaths): Promise<AuditReport> {
  const auditPath = join(paths.audits, 'audit.json');
  const audit = JSON.parse(await readFile(auditPath, 'utf8')) as AuditReport;
  assert(
    audit.pages === audit.sourceMetadata.indexedPages,
    `Processed ${audit.pages}/${audit.sourceMetadata.indexedPages} indexed pages`,
  );
  assert(
    audit.sourceMetadata.missingMetadata === 0,
    `${audit.sourceMetadata.missingMetadata} pages lack source metadata`,
  );
  assert(
    audit.sourceMetadata.hashMismatches === 0,
    `${audit.sourceMetadata.hashMismatches} raw hashes differ from the immutable index`,
  );
  assert(
    audit.sourceMetadata.duplicateSourceUrls === 0,
    `${audit.sourceMetadata.duplicateSourceUrls} source URLs are duplicated`,
  );
  assert(
    audit.replacementCharacters === 0,
    `${audit.replacementCharacters} U+FFFD characters remain`,
  );
  assert(audit.mojibakeSignals === 0, `${audit.mojibakeSignals} mojibake signals remain`);
  assert(
    audit.invalidSourceUrls.length === 0,
    `${audit.invalidSourceUrls.length} invalid source URLs remain`,
  );
  await Promise.all(
    [
      'pages.jsonl',
      'entities.jsonl',
      'relationships.jsonl',
      'facts.jsonl',
      'rag.jsonl',
      'pokopia-canonical.sqlite',
    ].map((name) => access(join(paths.canonical, name))),
  );
  const database = new Database(join(paths.canonical, 'pokopia-canonical.sqlite'), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const integrity = database.prepare('PRAGMA integrity_check').get() as {
      integrity_check: string;
    };
    assert(
      integrity.integrity_check === 'ok',
      `Canonical SQLite integrity: ${integrity.integrity_check}`,
    );
    const foreignKeys = database.prepare('PRAGMA foreign_key_check').all();
    assert(
      foreignKeys.length === 0,
      `Canonical SQLite has ${foreignKeys.length} foreign key errors`,
    );
    const counts = database
      .prepare(
        'SELECT (SELECT COUNT(*) FROM pages) pages, (SELECT COUNT(*) FROM rag_chunks) chunks',
      )
      .get() as { pages: number; chunks: number };
    assert(
      counts.pages === audit.pages,
      `SQLite pages ${counts.pages} != audit pages ${audit.pages}`,
    );
    assert(
      counts.chunks === audit.ragChunks,
      `SQLite chunks ${counts.chunks} != audit chunks ${audit.ragChunks}`,
    );
  } finally {
    database.close();
  }
  return audit;
}

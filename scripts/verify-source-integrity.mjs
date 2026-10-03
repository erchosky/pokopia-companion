import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(
  readFileSync(resolve(root, 'data/source/SNAPSHOT_MANIFEST.json'), 'utf8'),
);
const archivePath = resolve(root, manifest.archive);
const extractedPath = resolve(root, manifest.extractedRelativePath);
const masterIndexPath = resolve(extractedPath, manifest.masterIndexRelativePath);
const sourceDatabasePath = resolve(extractedPath, manifest.sqliteRelativePath);
const reviewManifestPath = resolve(root, 'audit-data/review-database-manifest.json');
const reviewDatabasePath = resolve(root, 'audit-data/pokopia-review.sqlite');

if (!existsSync(archivePath)) {
  throw new Error(`Missing immutable source archive: ${archivePath}`);
}

for (const [label, path] of [
  ['derived source extraction', extractedPath],
  ['master index', masterIndexPath],
  ['source SQLite', sourceDatabasePath],
  ['review database manifest', reviewManifestPath],
  ['review database', reviewDatabasePath],
]) {
  if (!existsSync(path)) throw new Error(`Missing ${label}: ${path}`);
}

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

expectEqual('Source archive bytes mismatch', statSync(archivePath).size, manifest.archiveBytes);
expectEqual('Source archive checksum mismatch', await sha256(archivePath), manifest.sha256);
expectEqual(
  'MASTER_INDEX checksum mismatch',
  await sha256(masterIndexPath),
  manifest.masterIndexSha256,
);
expectEqual(
  'Source SQLite bytes mismatch',
  statSync(sourceDatabasePath).size,
  manifest.sqliteBytes,
);
expectEqual(
  'Source SQLite checksum mismatch',
  await sha256(sourceDatabasePath),
  manifest.sqliteSha256,
);

const masterIndex = JSON.parse(readFileSync(masterIndexPath, 'utf8'));
expectEqual('Master page count mismatch', masterIndex.pages.length, manifest.pageCount);
expectEqual('Master stats page count mismatch', masterIndex.stats.pages, manifest.pageCount);
expectEqual(
  'Master RAW byte count mismatch',
  masterIndex.stats.raw_html_bytes,
  manifest.rawHtmlBytes,
);

let rawBytes = 0;
const masterDocuments = new Map();
for (const page of masterIndex.pages) {
  const rawPath = resolve(extractedPath, page.raw_path);
  if (!existsSync(rawPath)) throw new Error(`Missing RAW page: ${page.raw_path}`);
  const bytes = statSync(rawPath).size;
  expectEqual(`RAW byte mismatch for ${page.raw_path}`, bytes, page.raw_bytes);
  expectEqual(`RAW hash mismatch for ${page.raw_path}`, await sha256(rawPath), page.sha256);
  rawBytes += bytes;
  masterDocuments.set(page.url, page.sha256);
}
expectEqual('Verified RAW byte total mismatch', rawBytes, manifest.rawHtmlBytes);

const sourceDb = new DatabaseSync(sourceDatabasePath, { readOnly: true });
expectEqual(
  'Source SQLite integrity check failed',
  sourceDb.prepare('pragma integrity_check').get().integrity_check,
  'ok',
);
expectEqual(
  'Source SQLite page count mismatch',
  sourceDb.prepare('select count(*) as count from pages').get().count,
  manifest.pageCount,
);
sourceDb.close();

const reviewManifest = JSON.parse(readFileSync(reviewManifestPath, 'utf8'));
expectEqual(
  'Review SQLite checksum mismatch',
  await sha256(reviewDatabasePath),
  reviewManifest.sha256,
);
const reviewDb = new DatabaseSync(reviewDatabasePath, { readOnly: true });
expectEqual(
  'Review SQLite integrity check failed',
  reviewDb.prepare('pragma integrity_check').get().integrity_check,
  'ok',
);
for (const [table, expected] of Object.entries(reviewManifest.rowCounts)) {
  const allowed = new Set([
    'pages',
    'entities',
    'page_tables',
    'table_cells',
    'links',
    'facts',
    'relationships',
    'rag_chunks',
    'rag_fts',
    'quantitative_assertions',
  ]);
  if (!allowed.has(table)) throw new Error(`Unexpected review manifest table: ${table}`);
  expectEqual(
    `Review row-count mismatch for ${table}`,
    reviewDb.prepare(`select count(*) as count from ${table}`).get().count,
    expected,
  );
}
for (const page of reviewDb.prepare('select source_url, source_hash from pages').all()) {
  const expectedHash = masterDocuments.get(page.source_url);
  if (!expectedHash)
    throw new Error(`Review source references a document absent from master: ${page.source_url}`);
  expectEqual(`Review source hash mismatch for ${page.source_url}`, page.source_hash, expectedHash);
}
reviewDb.close();

console.log(
  `Master source verified: ${manifest.snapshotId}; ${manifest.pageCount} RAW pages; archive, index, SQLite and REVIEW references intact.`,
);

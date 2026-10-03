import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(import.meta.dirname, '..');
const auditRoot = resolve(root, 'audit-data');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function equal(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const readme = readJson(resolve(auditRoot, 'README.json'));
const databaseManifest = readJson(resolve(auditRoot, 'review-database-manifest.json'));
const databasePath = resolve(auditRoot, databaseManifest.file);
if (!existsSync(databasePath)) throw new Error(`Missing REVIEW SQLite: ${databasePath}`);
equal('REVIEW SQLite bytes mismatch', statSync(databasePath).size, databaseManifest.bytes);
equal('REVIEW SQLite hash mismatch', await sha256(databasePath), databaseManifest.sha256);

for (const entry of readme.files) {
  const path = resolve(auditRoot, entry);
  if (!existsSync(path)) throw new Error(`Missing declared REVIEW audit artifact: ${entry}`);
}

const database = new DatabaseSync(databasePath, { readOnly: true });
equal(
  'REVIEW SQLite integrity mismatch',
  database.prepare('pragma integrity_check').get().integrity_check,
  databaseManifest.integrityCheck,
);
equal(
  'REVIEW SQLite foreign-key mismatch',
  database.prepare('pragma foreign_key_check').all().length,
  databaseManifest.foreignKeyViolations,
);
for (const [table, expected] of Object.entries(databaseManifest.rowCounts)) {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`Unsafe REVIEW table name: ${table}`);
  equal(
    `REVIEW row-count mismatch for ${table}`,
    database.prepare(`select count(*) as count from ${table}`).get().count,
    expected,
  );
}
database.close();

console.log(
  `Existing REVIEW audit verified: ${databaseManifest.file}; ${Object.keys(databaseManifest.rowCounts).length} table counts; declared artifacts present.`,
);

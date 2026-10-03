import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createGameDataRepository, resolveDatabasePath } from '@pokopia/game-data';
import { assertCanonicalSeedBundle } from './seed-contract.js';
import {
  importCanonicalRuntime,
  validateCanonicalRuntime,
  type RuntimeImportMode,
} from './runtime-seed.js';

const first = process.argv[2];
if (first?.endsWith('.json') && existsSync(first)) {
  const parsed: unknown = JSON.parse(await readFile(first, 'utf8'));
  assertCanonicalSeedBundle(parsed);
  process.stdout.write(
    `Validated ${parsed.entities.length} entities and ${parsed.assertions.length} staged assertions from ${parsed.source.snapshotKey}.\n`,
  );
  process.exit(0);
}

const mode = (first ?? 'seed') as RuntimeImportMode;
if (!['seed', 'dry-run', 'validate'].includes(mode))
  throw new Error('Usage: seed.ts <seed|dry-run|validate> [sqlite-path]');
const sqlitePath = process.argv[3] ?? resolveDatabasePath();
if (!sqlitePath) throw new Error('Canonical SQLite not found; set POKOPIA_DATABASE_PATH.');
const repository = createGameDataRepository(sqlitePath);
const validation = validateCanonicalRuntime(repository);
if (!validation.valid) {
  process.stderr.write(`${JSON.stringify(validation, null, 2)}\n`);
  process.exit(1);
}
if (mode === 'validate' || mode === 'dry-run') {
  process.stdout.write(`${JSON.stringify({ mode, ...validation }, null, 2)}\n`);
  process.exit(0);
}
const connectionString = process.env.DATABASE_URL ?? process.env.POKOPIA_DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL or POKOPIA_DATABASE_URL is required.');
const result = await importCanonicalRuntime(repository, connectionString, {
  allowRemote:
    process.argv.includes('--allow-remote') &&
    process.env.POKOPIA_ALLOW_REMOTE_SEED === 'I_UNDERSTAND',
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

import Database from 'better-sqlite3';
import { LegacySnapshotRepository } from './legacy-repository';
import { resolveDatabasePath } from './path';
import type { GameDataRepository } from './types';
import { loadPostgresGameDataRepository } from './postgres-repository';

export * from './types';
export { findRepositoryRoot, resolveDatabasePath } from './path';
export { loadPostgresGameDataRepository } from './postgres-repository';

let singleton: GameDataRepository | undefined;
let asyncSingleton: Promise<GameDataRepository> | undefined;

export type GameDataBackend = 'sqlite' | 'postgres';

export async function createGameDataRepositoryAsync(options?: {
  readonly backend?: GameDataBackend;
  readonly databasePath?: string | null;
  readonly connectionString?: string | null;
}): Promise<GameDataRepository> {
  const backend = options?.backend ?? parseBackend(process.env.POKOPIA_DATA_BACKEND);
  if (backend === 'postgres') {
    const connectionString =
      options?.connectionString ??
      process.env.POKOPIA_DATABASE_URL ??
      process.env.DATABASE_URL ??
      null;
    if (!connectionString)
      throw new Error(
        'POKOPIA_DATA_BACKEND=postgres requires POKOPIA_DATABASE_URL or DATABASE_URL.',
      );
    return loadPostgresGameDataRepository(connectionString);
  }
  return createGameDataRepository(options?.databasePath ?? resolveDatabasePath());
}

export function createGameDataRepository(databasePath = resolveDatabasePath()): GameDataRepository {
  if (!databasePath)
    throw new Error(
      'No Pokopia SQLite database found. Run the ingestion pipeline or set POKOPIA_DATABASE_PATH.',
    );
  const probe = new Database(databasePath, { readonly: true, fileMustExist: true });
  const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
    name: string;
  }[];
  probe.close();
  const names = new Set(tables.map((row) => row.name));
  if (names.has('pages') && names.has('table_rows') && names.has('facts'))
    return new LegacySnapshotRepository(databasePath);
  if (
    names.has('pages') &&
    names.has('page_tables') &&
    names.has('table_cells') &&
    names.has('rag_fts')
  )
    return new LegacySnapshotRepository(databasePath, 'canonical');
  throw new Error(
    `Unsupported Pokopia SQLite schema at ${databasePath}. Expected legacy tables or a registered canonical adapter.`,
  );
}

export function gameData(): GameDataRepository {
  if (parseBackend(process.env.POKOPIA_DATA_BACKEND) === 'postgres')
    throw new Error('PostgreSQL is asynchronous; use gameDataAsync() in server code.');
  singleton ??= createGameDataRepository();
  return singleton;
}

export function gameDataAsync(): Promise<GameDataRepository> {
  // A failed load (for example a transient PostgreSQL outage) must not poison the process forever.
  asyncSingleton ??= createGameDataRepositoryAsync().catch((error: unknown) => {
    asyncSingleton = undefined;
    throw error;
  });
  return asyncSingleton;
}

function parseBackend(value: string | undefined): GameDataBackend {
  if (!value || value === 'sqlite') return 'sqlite';
  if (value === 'postgres') return 'postgres';
  throw new Error(`Unsupported POKOPIA_DATA_BACKEND=${value}; use sqlite or postgres.`);
}

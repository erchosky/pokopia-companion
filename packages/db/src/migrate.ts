import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const configuredDatabaseUrl = process.env.DATABASE_URL;
if (!configuredDatabaseUrl) throw new Error('DATABASE_URL is required to run migrations');
const databaseUrl: string = configuredDatabaseUrl;

const migrationDirectory = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));
const migrationFiles = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const psqlEnvironment = { ...process.env, PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT ?? '5' };

function psql(arguments_: readonly string[], input?: string): string {
  return execFileSync('psql', [databaseUrl, '--set', 'ON_ERROR_STOP=1', ...arguments_], {
    encoding: 'utf8',
    env: psqlEnvironment,
    input,
    stdio: input ? ['pipe', 'pipe', 'inherit'] : ['ignore', 'pipe', 'inherit'],
  });
}

psql([
  '--command',
  `
  create schema if not exists app_private;
  create table if not exists app_private.schema_migrations (
    migration_id text primary key,
    applied_at timestamptz not null default now()
  );
`,
]);

const applied = new Set(
  psql([
    '--tuples-only',
    '--no-align',
    '--command',
    'select migration_id from app_private.schema_migrations',
  ])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
);

for (const file of migrationFiles) {
  const migrationId = file.replace(/\.sql$/, '');
  if (applied.has(migrationId)) continue;
  psql(['--file', `${migrationDirectory}/${file}`]);
  psql([
    '--set',
    `migration_id=${migrationId}`,
    '--command',
    "insert into app_private.schema_migrations(migration_id) values (:'migration_id')",
  ]);
  process.stdout.write(`Applied ${migrationId}\n`);
}

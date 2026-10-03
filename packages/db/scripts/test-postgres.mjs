import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDirectory = fileURLToPath(
  new URL('../../../supabase/migrations/', import.meta.url),
);
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const seedEntry = fileURLToPath(new URL('../src/seed.ts', import.meta.url));
const canonicalDatabaseCandidates = [
  fileURLToPath(new URL('../../../data/canonical/v3.1/pokopia-canonical.sqlite', import.meta.url)),
  fileURLToPath(new URL('../../../audit-data/pokopia-review.sqlite', import.meta.url)),
];
const canonicalDatabase = canonicalDatabaseCandidates.find((path) => existsSync(path));
if (!canonicalDatabase) {
  throw new Error(`Canonical SQLite not found. Checked: ${canonicalDatabaseCandidates.join(', ')}`);
}
const externalUrl = process.env.POKOPIA_TEST_DATABASE_URL;

function available(command) {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `${command} failed\n`);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function runExpectFailure(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status === 0) {
    process.stderr.write(`Expected command to fail: ${command} ${args.join(' ')}\n`);
    process.exit(1);
  }
}

if (!available('psql')) {
  process.stdout.write('SKIP: psql is not installed; static SQL tests remain available.\n');
  process.exit(0);
}

let databaseUrl = externalUrl;
let temporaryDirectory;
let port;

if (!databaseUrl && available('initdb') && available('pg_ctl')) {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'pokopia-postgres-'));
  port = String(55432 + Math.floor(Math.random() * 900));
  run('initdb', ['--auth=trust', '--no-locale', '--encoding=UTF8', '-D', temporaryDirectory], {
    stdio: 'ignore',
  });
  run('pg_ctl', ['-D', temporaryDirectory, '-o', `-F -p ${port}`, '-w', 'start'], {
    stdio: 'ignore',
  });
  databaseUrl = `postgresql://localhost:${port}/postgres`;
}

if (!databaseUrl) {
  process.stdout.write(
    'SKIP: set POKOPIA_TEST_DATABASE_URL to a disposable database for dynamic migration tests.\n',
  );
  process.exit(0);
}

try {
  run('psql', [databaseUrl, '--set', 'ON_ERROR_STOP=1'], {
    input: `
      do $roles$
      begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then
          create role anon nologin;
        end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then
          create role authenticated nologin;
        end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then
          create role service_role nologin bypassrls;
        end if;
      end
      $roles$;
    `,
  });
  for (const file of readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    run('psql', [
      databaseUrl,
      '--set',
      'ON_ERROR_STOP=1',
      '--file',
      join(migrationsDirectory, file),
    ]);
  }
  if (!externalUrl) {
    const seedEnvironment = { ...process.env, DATABASE_URL: databaseUrl };
    const tsx = join(repositoryRoot, 'node_modules', '.bin', 'tsx');
    run(tsx, [seedEntry, 'seed', canonicalDatabase], {
      cwd: repositoryRoot,
      env: seedEnvironment,
    });
    const repositoryParity = run(
      tsx,
      [
        join(repositoryRoot, 'packages', 'db', 'scripts', 'test-parity.ts'),
        canonicalDatabase,
        databaseUrl,
        join(repositoryRoot, 'audit-data', 'iteration-4', 'postgres-parity.json'),
      ],
      { cwd: repositoryRoot, env: seedEnvironment },
    );
    if (!repositoryParity.includes('pokopia_repository_parity_ok'))
      throw new Error('Repository parity marker missing');
    run(tsx, [seedEntry, 'seed', canonicalDatabase], {
      cwd: repositoryRoot,
      env: seedEnvironment,
    });
    const parity = run(
      'psql',
      [databaseUrl, '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align'],
      {
        input: `
          select case when
            (select count(*) from public.pokemon) = 365 and
            (select count(*) from public.recipes) = 882 and
            (select count(*) from public.towns) = 7 and
            (select count(*) from public.source_assertions where predicate = 'runtime.canonical_projection') = 3047 and
            (select count(*) from public.quantitative_parameters) = 114 and
            (select count(*) from public.recipes where batch_size is null and batch_size_status = 'unknown') = 882 and
            (select count(*) from public.recipe_outputs where quantity is null and quantity_status = 'unknown') = 882 and
            (select count(*) from public.quests) = 5 and
            (select count(*) from public.treasure_maps) = 6 and
            (select count(*) from public.collectibles) = 53 and
            (select count(*) from public.ditto_moves) = 14 and
            (select count(*) from public.ingestion_runs where status = 'completed') = 1
          then 'pokopia_seed_parity_ok' else 'pokopia_seed_parity_failed' end;
        `,
      },
    );
    if (!parity.includes('pokopia_seed_parity_ok'))
      throw new Error(`Seed parity marker missing: ${parity}`);
  }
  const checks = readFileSync(
    fileURLToPath(new URL('./verify-schema.sql', import.meta.url)),
    'utf8',
  );
  const output = run(
    'psql',
    [databaseUrl, '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align'],
    {
      input: checks,
    },
  );
  if (!output.includes('pokopia_schema_ok')) throw new Error('Schema verification marker missing');

  const adversarial = run(
    'psql',
    [databaseUrl, '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align'],
    {
      input: `
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"role":"user"}}', true);
        insert into public.user_profiles(user_id, display_name)
          values ('11111111-1111-4111-8111-111111111111', 'Owner A')
          on conflict (user_id) do update set display_name = excluded.display_name
          returning user_id;
        commit;

        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"role":"user"}}', true);
        insert into public.user_profiles(user_id, display_name)
          values ('22222222-2222-4222-8222-222222222222', 'Owner B')
          on conflict (user_id) do update set display_name = excluded.display_name;
        commit;

        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","user_metadata":{"role":"admin"},"app_metadata":{"role":"user"}}', true);
        select case when
          (select count(*) from public.user_profiles) = 1 and
          (select count(*) from public.user_profiles where user_id = '22222222-2222-4222-8222-222222222222') = 0 and
          (select count(*) from public.staging_records) = 0
        then 'pokopia_owner_isolation_ok' else 'pokopia_owner_isolation_failed' end;
        commit;

        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"role":"admin"}}', true);
        select count(*) from public.staging_records;
        insert into public.admin_audit_log(actor_user_id, action, table_name, result)
          values ('11111111-1111-4111-8111-111111111111', 'test.read', 'staging_records', 'success');
        commit;

        begin;
        set local role anon;
        select case when
          has_table_privilege('anon', 'public.entities', 'select') and
          not has_table_privilege('anon', 'public.user_profiles', 'insert')
        then 'pokopia_anon_grants_ok' else 'pokopia_anon_grants_failed' end;
        select count(*) from public.entities;
        commit;

        select case when
          has_table_privilege('service_role', 'app_private.rate_limit_buckets', 'select,insert,update,delete') and
          not has_schema_privilege('anon', 'app_private', 'usage') and
          not has_table_privilege('authenticated', 'app_private.rate_limit_buckets', 'select') and
          not exists (
            select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public', 'app_private') and p.prosecdef
          ) and
          not exists (
            select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'v'
              and not coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
          )
        then 'pokopia_privileged_surface_ok' else 'pokopia_privileged_surface_failed' end;
      `,
    },
  );
  for (const marker of [
    'pokopia_owner_isolation_ok',
    'pokopia_anon_grants_ok',
    'pokopia_privileged_surface_ok',
  ])
    if (!adversarial.includes(marker)) throw new Error(`Adversarial RLS marker missing: ${marker}`);

  runExpectFailure('psql', [databaseUrl, '--set', 'ON_ERROR_STOP=1'], {
    input: `
        begin;
        set local role authenticated;
        select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"role":"user"}}', true);
        insert into public.user_profiles(user_id, display_name)
          values ('22222222-2222-4222-8222-222222222222', 'IDOR')
          on conflict (user_id) do update set display_name = excluded.display_name
          returning user_id;
        commit;
      `,
  });
  runExpectFailure('psql', [databaseUrl, '--set', 'ON_ERROR_STOP=1'], {
    input: `update public.admin_audit_log set action = 'tampered' where action = 'test.read';`,
  });
  runExpectFailure('psql', [databaseUrl, '--set', 'ON_ERROR_STOP=1'], {
    input: `
      insert into public.gameplay_measurements(metric_key, metric_label, unit, status, idempotency_key)
      values ('storage.capacity', 'Storage capacity', 'items', 'accepted', 'invalid-auto-promotion');
    `,
  });

  const tsx = join(repositoryRoot, 'node_modules', '.bin', 'tsx');
  const rateLimitOutput = run(
    tsx,
    [join(repositoryRoot, 'packages', 'security', 'scripts', 'test-postgres.ts')],
    { cwd: repositoryRoot, env: { ...process.env, POKOPIA_TEST_DATABASE_URL: databaseUrl } },
  );
  if (!rateLimitOutput.includes('pokopia_postgres_rate_limit_ok'))
    throw new Error('PostgreSQL rate-limit concurrency marker missing');
  process.stdout.write(
    `PASS: migrations, constraints, adversarial RLS/grants and atomic rate limiting${externalUrl ? '' : ', idempotent seed and canonical counts'} verified.\n`,
  );
} finally {
  if (temporaryDirectory) {
    spawnSync('pg_ctl', ['-D', temporaryDirectory, '-m', 'fast', '-w', 'stop'], {
      stdio: 'ignore',
    });
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

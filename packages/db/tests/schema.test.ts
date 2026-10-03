import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = fileURLToPath(
  new URL('../../../supabase/migrations/', import.meta.url),
);
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const sql = migrationFiles
  .map((file) => readFileSync(`${migrationsDirectory}/${file}`, 'utf8'))
  .join('\n');

describe('canonical PostgreSQL migrations', () => {
  it('uses versioned, ordered migration names', () => {
    expect(migrationFiles).toEqual([...migrationFiles].sort());
    for (const file of migrationFiles) expect(file).toMatch(/^\d{12}_[a-z0-9_]+\.sql$/);
  });

  it('models provenance and separates knowledge from user state', () => {
    for (const table of [
      'source_snapshots',
      'source_documents',
      'source_assertions',
      'source_evidence',
      'source_conflicts',
      'source_verifications',
      'knowledge_gaps',
      'research_tasks',
      'user_entity_progress',
      'saved_recommendations',
    ]) {
      expect(sql).toContain(`create table public.${table}`);
    }
    expect(sql).toMatch(
      /create type public\.knowledge_kind as enum \('fact', 'inference', 'recommendation'\)/,
    );
  });

  it('keeps semantic relation identity separate from multiple evidence records', () => {
    expect(sql).toContain('assertion_hash text not null unique');
    expect(sql).toContain('assertion_id uuid not null references public.source_assertions');
    expect(sql).toContain('unique nulls not distinct (assertion_id, source_document_id, locator)');
    expect(sql).toContain('assertion_id uuid primary key references public.source_assertions');
  });

  it('protects every user and admin table with classified RLS policies', () => {
    expect(sql).toContain('declare user_tables constant text[]');
    expect(sql).toContain('declare admin_tables constant text[]');
    expect(sql).toContain('create policy user_owns_rows');
    expect(sql).toContain('create policy administrators_only');
    expect(sql).toContain('alter table public.%I enable row level security');
    expect(sql).toContain('app_private.current_user_id() = user_id');
    expect(sql).toContain('{app_metadata,role}');
  });

  it('keeps Data API grants separate from RLS and revokes defaults', () => {
    expect(sql).toContain('grant select on table %s to anon');
    expect(sql).toContain('grant select on table %s to authenticated');
    expect(sql).toContain('revoke all on all tables in schema public from public');
    expect(sql).toContain('alter default privileges');
  });

  it('has strong foreign keys and a generated full-text search projection', () => {
    expect(sql).toMatch(/references public\.entities\(id\)/g);
    expect(sql).toContain('document tsvector generated always as');
    expect(sql).toContain('using gin(document)');
  });

  it('adds Iteration 4 progression without editing the released baseline migrations', () => {
    expect(migrationFiles).toContain('202608110001_iteration_4_progression.sql');
    expect(sql).toContain("alter type public.entity_kind add value if not exists 'ditto_move'");
    expect(sql).toContain('create table public.entity_content_classifications');
    expect(sql).toContain('create table public.treasure_map_requirements');
    expect(sql).toContain('create table public.ditto_moves');
    expect(sql).toContain('create table public.ditto_move_pokemon');
    expect(sql).toContain('alter table public.ditto_moves enable row level security');
  });

  it('adds Iteration 4.5 hardening as an append-only migration', () => {
    expect(migrationFiles).toContain('202608110002_iteration_4_5_hardening.sql');
    expect(sql).toContain('create table app_private.rate_limit_buckets');
    expect(sql).toContain('create table public.gameplay_measurements');
    expect(sql).toContain('create table public.gameplay_measurement_observations');
    expect(sql).toContain('admin_audit_log_append_only');
    expect(sql).toContain("status <> 'accepted' or candidate_assertion_id is not null");
  });

  it('adds Iteration 5.1 quantitative evidence without retaining invented recipe defaults', () => {
    expect(migrationFiles).toContain('202608120001_iteration_5_1_quantitative_evidence.sql');
    expect(sql).toContain('create table public.quantitative_parameters');
    expect(sql).toContain('alter table public.recipes alter column batch_size drop default');
    expect(sql).toContain('alter table public.recipes alter column batch_size drop not null');
    expect(sql).toContain("review_status text not null default 'candidate'");
    expect(sql).toContain('create policy quantitative_parameters_admin_all');
  });

  it('does not depend on Supabase auth schema in portable migrations', () => {
    expect(sql).not.toContain('references auth.users');
    expect(sql).not.toContain('auth.uid()');
    expect(sql).not.toContain('security definer');
  });
});

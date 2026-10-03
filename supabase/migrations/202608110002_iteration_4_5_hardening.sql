-- Iteration 4.5 local hardening: distributed abuse control, immutable audit and gameplay measurements.
-- This migration is append-only and has not been applied to a hosted Supabase project.
begin;

create table app_private.rate_limit_buckets (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (reset_at > window_started_at)
);
create index rate_limit_buckets_reset_idx on app_private.rate_limit_buckets(reset_at);

revoke all on app_private.rate_limit_buckets from public;
do $rate_limit_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on app_private.rate_limit_buckets from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on app_private.rate_limit_buckets from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on app_private.rate_limit_buckets to service_role;
  end if;
end
$rate_limit_grants$;

create type public.measurement_status as enum (
  'proposed', 'measured', 'replicated', 'disputed', 'accepted', 'superseded'
);
create type public.observation_status as enum ('measured', 'unknown', 'error', 'excluded');

create table public.gameplay_measurements (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null check (metric_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  metric_label text not null check (btrim(metric_label) <> ''),
  game_version_id uuid references public.game_versions(id) on delete restrict,
  setup jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  unit text not null check (btrim(unit) <> ''),
  status public.measurement_status not null default 'proposed',
  tester_ref text,
  candidate_assertion_id uuid references public.source_assertions(id) on delete set null,
  idempotency_key text not null unique check (btrim(idempotency_key) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(setup) = 'object'),
  check (jsonb_typeof(conditions) = 'object'),
  check (status <> 'accepted' or candidate_assertion_id is not null)
);

create table public.gameplay_measurement_observations (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.gameplay_measurements(id) on delete cascade,
  repetition integer not null check (repetition > 0),
  status public.observation_status not null,
  measured_value numeric,
  uncertainty numeric check (uncertainty is null or uncertainty >= 0),
  independent_variables jsonb not null default '{}'::jsonb,
  evidence_ref text,
  source_document_id uuid references public.source_documents(id) on delete restrict,
  error_reason text,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (measurement_id, repetition),
  check (jsonb_typeof(independent_variables) = 'object'),
  check (
    (status = 'measured' and measured_value is not null and error_reason is null)
    or (status in ('unknown', 'error', 'excluded') and measured_value is null)
  ),
  check (status <> 'error' or nullif(btrim(error_reason), '') is not null),
  check (status <> 'measured' or evidence_ref is not null or source_document_id is not null)
);

create index gameplay_measurements_metric_status_idx
  on public.gameplay_measurements(metric_key, status);
create index gameplay_measurement_observations_measurement_idx
  on public.gameplay_measurement_observations(measurement_id, repetition);

create trigger gameplay_measurements_set_updated_at
  before update on public.gameplay_measurements
  for each row execute function app_private.set_updated_at();

alter table public.gameplay_measurements enable row level security;
alter table public.gameplay_measurement_observations enable row level security;
create policy measurement_admin_all on public.gameplay_measurements
  for all to public using (app_private.is_admin()) with check (app_private.is_admin());
create policy measurement_observation_admin_all on public.gameplay_measurement_observations
  for all to public using (app_private.is_admin()) with check (app_private.is_admin());

do $measurement_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.gameplay_measurements,
      public.gameplay_measurement_observations to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.gameplay_measurements, public.gameplay_measurement_observations to service_role;
  end if;
end
$measurement_grants$;

alter table public.admin_audit_log
  add column result text not null default 'success'
    check (result in ('success', 'denied', 'failed')),
  add column correlation_id text,
  add column metadata jsonb not null default '{}'::jsonb,
  add constraint admin_audit_log_metadata_object check (jsonb_typeof(metadata) = 'object'),
  add constraint admin_audit_log_action_nonempty check (btrim(action) <> ''),
  add constraint admin_audit_log_table_nonempty check (btrim(table_name) <> '');

drop policy administrators_only on public.admin_audit_log;
create policy admin_audit_read on public.admin_audit_log
  for select to public using (app_private.is_admin());
create policy admin_audit_append on public.admin_audit_log
  for insert to public with check (
    app_private.is_admin()
    and (actor_user_id is null or actor_user_id = app_private.current_user_id())
  );

create function app_private.reject_admin_audit_mutation() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  raise exception 'admin_audit_log is append-only';
end;
$$;
revoke execute on function app_private.reject_admin_audit_mutation() from public;

create trigger admin_audit_log_append_only
  before update or delete on public.admin_audit_log
  for each row execute function app_private.reject_admin_audit_mutation();

alter default privileges for role current_user in schema app_private
  revoke all on tables from public;

commit;

-- User state, reviewed ingestion, explicit grants and RLS.
begin;

create table public.user_profiles (
  user_id uuid primary key,
  display_name text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_entity_progress (
  user_id uuid not null,
  entity_id uuid not null references public.entities(id) on delete cascade,
  status text not null check (status in ('not_started','in_progress','completed','skipped')),
  quantity numeric check (quantity is null or quantity >= 0),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_id)
);
create table public.user_inventory (
  user_id uuid not null,
  item_id uuid not null references public.items(id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create table public.user_town_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  town_id uuid references public.towns(id) on delete restrict,
  name text not null,
  preset text,
  game_version_id uuid references public.game_versions(id) on delete restrict,
  layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  target_entity_id uuid references public.entities(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','archived')),
  target_quantity numeric check (target_quantity is null or target_quantity > 0),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_checklists (
  user_id uuid not null,
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, checklist_id, entity_id),
  foreign key (checklist_id, entity_id)
    references public.checklist_entries(checklist_id, entity_id) on delete cascade
);
create table public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_id uuid references public.entities(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.saved_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  score_observation_id uuid not null references public.score_observations(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  unique (user_id, score_observation_id)
);

-- Administrative ingestion is isolated from canonical records and review-gated.
create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_snapshot_id uuid not null references public.source_snapshots(id) on delete restrict,
  parser_version text not null,
  status text not null check (status in ('pending','running','review','completed','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  statistics jsonb not null default '{}'::jsonb,
  error_summary text,
  created_at timestamptz not null default now()
);
create table public.staging_records (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete restrict,
  record_kind text not null,
  natural_key text not null,
  payload jsonb not null,
  payload_hash text not null,
  validation_status text not null default 'pending'
    check (validation_status in ('pending','valid','warning','invalid','conflicting')),
  validation_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (ingestion_run_id, record_kind, natural_key, payload_hash)
);
create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  staging_record_id uuid not null references public.staging_records(id) on delete cascade,
  reviewer_user_id uuid not null,
  decision text not null check (decision in ('accept','reject','defer','merge','needs_research')),
  notes text,
  decided_at timestamptz not null default now()
);
create table public.snapshot_diffs (
  id uuid primary key default gen_random_uuid(),
  previous_snapshot_id uuid references public.source_snapshots(id) on delete restrict,
  current_snapshot_id uuid not null references public.source_snapshots(id) on delete restrict,
  entity_kind text not null,
  natural_key text not null,
  change_type text not null check (change_type in ('added','removed','modified','unchanged','conflicting')),
  before_hash text,
  after_hash text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique nulls not distinct (previous_snapshot_id, current_snapshot_id, entity_kind, natural_key)
);
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);

create index user_progress_user_status_idx on public.user_entity_progress(user_id, status);
create index user_goals_user_status_idx on public.user_goals(user_id, status);
create index staging_records_review_idx on public.staging_records(validation_status, record_kind);
create index snapshot_diffs_change_idx on public.snapshot_diffs(current_snapshot_id, change_type);
create index admin_audit_log_actor_idx on public.admin_audit_log(actor_user_id, occurred_at desc);

create trigger user_profiles_set_updated_at before update on public.user_profiles
  for each row execute function app_private.set_updated_at();
create trigger user_entity_progress_set_updated_at before update on public.user_entity_progress
  for each row execute function app_private.set_updated_at();
create trigger user_inventory_set_updated_at before update on public.user_inventory
  for each row execute function app_private.set_updated_at();
create trigger user_town_plans_set_updated_at before update on public.user_town_plans
  for each row execute function app_private.set_updated_at();
create trigger user_goals_set_updated_at before update on public.user_goals
  for each row execute function app_private.set_updated_at();
create trigger user_checklists_set_updated_at before update on public.user_checklists
  for each row execute function app_private.set_updated_at();
create trigger user_notes_set_updated_at before update on public.user_notes
  for each row execute function app_private.set_updated_at();

-- Provider-neutral request context. Supabase/PostgREST supplies request.jwt.claims.
-- Other PostgreSQL hosts must set request.jwt.claims transaction-locally in trusted middleware.
create function app_private.current_user_id() returns uuid
language plpgsql stable security invoker set search_path = pg_catalog as $$
declare claims_text text;
declare subject_text text;
begin
  claims_text := current_setting('request.jwt.claims', true);
  if claims_text is null or claims_text = '' then return null; end if;
  subject_text := claims_text::jsonb ->> 'sub';
  if subject_text is null or subject_text !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  then return null; end if;
  return subject_text::uuid;
exception when others then
  return null;
end;
$$;

create function app_private.is_admin() returns boolean
language plpgsql stable security invoker set search_path = pg_catalog as $$
declare claims jsonb;
begin
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  return coalesce(claims #>> '{app_metadata,role}', '') in ('admin', 'data_admin');
exception when others then
  return false;
end;
$$;

-- PostgreSQL grants are the object-access layer. RLS is the row-access layer.
revoke all on schema public from public;
grant usage on schema public to public;
revoke all on schema app_private from public;
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema app_private from public;

do $security$
declare table_name text;
declare catalog_tables constant text[] := array[
  'games','game_versions','patches','dlcs','content_packs','events','entities',
  'categories','tags','roles','aliases','synonyms','entity_tags','pokemon','pokemon_forms',
  'pokemon_aliases','abilities','specialties','habitats','pokemon_roles','pokemon_abilities',
  'pokemon_specialties','pokemon_habitats','regions','zones','biomes','locations','towns',
  'environment_levels','pokemon_locations','item_categories','items','item_variants','materials',
  'resources','storage_types','containers','tools','key_items','consumables','item_sources',
  'material_sources','crafting_stations','recipes','recipe_ingredients','recipe_outputs',
  'building_categories','buildings','furniture','furniture_variants','facilities','structures',
  'construction_methods','crops','plants','berries','production_systems','production_inputs',
  'production_outputs','cycle_times','watering_methods','harvesting_methods','automation_systems',
  'automation_components','automation_steps','automation_inputs','automation_outputs',
  'automation_compatible_locations','automation_pokemon_roles','automation_limitations','conditions',
  'condition_groups','condition_requirements','requirements','effects','effect_targets','prerequisites',
  'dependencies','unlock_rules','pokemon_requirements','pokemon_unlocks','pokemon_preferences',
  'pokemon_effects','pokemon_synergies','town_unlocks','town_resources','town_facilities',
  'town_requirements','item_unlocks','recipe_requirements','building_requirements','building_effects',
  'building_construction_methods','automation_requirements','automation_effects','quests','quest_steps',
  'quest_requirements','progression_nodes','treasure_maps','collectibles','achievements','checklists',
  'checklist_entries','scoring_models','scoring_criteria','scoring_weights','score_observations',
  'score_explanations','sources','source_snapshots','search_entries'
];
declare provenance_tables constant text[] := array[
  'source_documents','source_assertions','source_evidence','source_verifications',
  'facts','assertions','relationships'
];
declare user_tables constant text[] := array[
  'user_profiles','user_entity_progress','user_inventory','user_town_plans','user_goals',
  'user_checklists','user_notes','saved_recommendations'
];
declare admin_tables constant text[] := array[
  'ingestion_runs','staging_records','review_decisions','snapshot_diffs','admin_audit_log',
  'source_conflicts','knowledge_gaps','research_tasks'
];
begin
  foreach table_name in array catalog_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy catalog_read on public.%I for select to public using (true)', table_name);
  end loop;

  foreach table_name in array user_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy user_owns_rows on public.%I for all to public using (app_private.current_user_id() = user_id) with check (app_private.current_user_id() = user_id)',
      table_name
    );
  end loop;

  foreach table_name in array provenance_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy provenance_admin_all on public.%I for all to public using (app_private.is_admin()) with check (app_private.is_admin())',
      table_name
    );
  end loop;
  create policy accepted_assertions_read on public.source_assertions for select to public
    using (lifecycle = 'accepted');
  create policy accepted_evidence_read on public.source_evidence for select to public
    using (exists (
      select 1 from public.source_assertions sa
      where sa.id = source_evidence.assertion_id and sa.lifecycle = 'accepted'
    ));
  create policy accepted_documents_read on public.source_documents for select to public
    using (exists (
      select 1 from public.source_evidence se
      join public.source_assertions sa on sa.id = se.assertion_id
      where se.source_document_id = source_documents.id and sa.lifecycle = 'accepted'
    ));
  create policy accepted_verifications_read on public.source_verifications for select to public
    using (exists (
      select 1 from public.source_assertions sa
      where sa.id = source_verifications.assertion_id and sa.lifecycle = 'accepted'
    ));
  create policy accepted_fact_markers_read on public.facts for select to public
    using (exists (
      select 1 from public.source_assertions sa
      where sa.id = facts.assertion_id and sa.lifecycle = 'accepted'
    ));
  create policy accepted_assertion_markers_read on public.assertions for select to public
    using (exists (
      select 1 from public.source_assertions sa
      where sa.id = assertions.assertion_id and sa.lifecycle = 'accepted'
    ));
  create policy accepted_relationships_read on public.relationships for select to public
    using (exists (
      select 1 from public.source_assertions sa
      where sa.id = relationships.assertion_id and sa.lifecycle = 'accepted'
    ));

  foreach table_name in array admin_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy administrators_only on public.%I for all to public using (app_private.is_admin()) with check (app_private.is_admin())',
      table_name
    );
  end loop;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute format('grant select on table %s to anon', (
      select string_agg(format('public.%I', value), ', ') from unnest(catalog_tables || provenance_tables) value
    ));
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute format('grant select on table %s to authenticated', (
      select string_agg(format('public.%I', value), ', ') from unnest(catalog_tables) value
    ));
    execute format('grant select, insert, update, delete on table %s to authenticated', (
      select string_agg(format('public.%I', value), ', ') from unnest(user_tables || admin_tables || provenance_tables) value
    ));
    grant usage on schema app_private to authenticated;
    grant execute on function app_private.current_user_id() to authenticated;
    grant execute on function app_private.is_admin() to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on all tables in schema public to service_role;
    grant usage, select on all sequences in schema public to service_role;
    grant usage on schema app_private to service_role;
    grant execute on all functions in schema app_private to service_role;
  end if;
end
$security$;

-- Future objects remain closed until a migration grants them deliberately.
alter default privileges for role current_user in schema public revoke all on tables from public;
alter default privileges for role current_user in schema public revoke all on sequences from public;
alter default privileges for role current_user in schema public revoke execute on functions from public;

commit;

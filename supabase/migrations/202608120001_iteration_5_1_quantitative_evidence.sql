-- Iteration 5.1: evidence-backed quantitative projections and honest unknown recipe yields.
-- Append-only; generated manually because the Supabase CLI is not installed in this workspace.
begin;

alter type public.entity_kind add value if not exists 'game_rule';
alter type public.entity_kind add value if not exists 'world_mechanic';
alter type public.entity_kind add value if not exists 'storage_system';

alter table public.recipes alter column batch_size drop default;
alter table public.recipes alter column batch_size drop not null;
alter table public.recipes add column batch_size_status text not null default 'unknown'
  check (batch_size_status in ('unknown', 'source_backed', 'accepted_measurement', 'disputed'));
alter table public.recipes add column batch_size_assertion_id uuid
  references public.source_assertions(id) on delete restrict;
alter table public.recipes add constraint recipes_batch_provenance_check check (
  (batch_size is null and batch_size_status in ('unknown', 'disputed'))
  or (batch_size is not null and batch_size > 0 and batch_size_status in ('source_backed', 'accepted_measurement')
      and batch_size_assertion_id is not null)
);
update public.recipes set batch_size = null, batch_size_status = 'unknown', batch_size_assertion_id = null;

alter table public.recipe_outputs drop constraint if exists recipe_outputs_quantity_check;
alter table public.recipe_outputs alter column quantity drop not null;
alter table public.recipe_outputs add column quantity_status text not null default 'unknown'
  check (quantity_status in ('unknown', 'source_backed', 'accepted_measurement', 'disputed'));
alter table public.recipe_outputs add column quantity_assertion_id uuid
  references public.source_assertions(id) on delete restrict;
alter table public.recipe_outputs add constraint recipe_outputs_quantity_provenance_check check (
  (quantity is null and quantity_status in ('unknown', 'disputed'))
  or (quantity is not null and quantity > 0 and quantity_status in ('source_backed', 'accepted_measurement')
      and quantity_assertion_id is not null)
);
update public.recipe_outputs
set quantity = null, quantity_status = 'unknown', quantity_assertion_id = null;

create table public.quantitative_parameters (
  id uuid primary key,
  subject_entity_id uuid not null references public.entities(id) on delete cascade,
  predicate text not null check (predicate ~ '^[a-z][a-z0-9_.-]*$'),
  value numeric not null,
  unit text not null check (btrim(unit) <> ''),
  qualifier text,
  derivation text not null check (derivation in ('source_fact', 'mathematical_derived')),
  assertion_id uuid not null unique references public.source_assertions(id) on delete restrict,
  parser_confidence numeric(5,4) not null check (parser_confidence between 0 and 1),
  evidence_confidence numeric(5,4) not null check (evidence_confidence between 0 and 1),
  local_assertion_status text not null check (local_assertion_status in ('accepted', 'candidate', 'disputed')),
  review_status text not null default 'candidate'
    check (review_status in ('candidate', 'accepted', 'disputed', 'superseded')),
  content_scope text not null check (content_scope in ('base_game', 'expansion', 'unknown')),
  game_version text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (subject_entity_id, predicate, qualifier, game_version)
);
create index quantitative_parameters_subject_predicate_idx
  on public.quantitative_parameters(subject_entity_id, predicate);
create index quantitative_parameters_review_idx
  on public.quantitative_parameters(review_status, local_assertion_status);
create trigger quantitative_parameters_set_updated_at
  before update on public.quantitative_parameters
  for each row execute function app_private.set_updated_at();

alter table public.quantitative_parameters enable row level security;
create policy quantitative_parameters_admin_all on public.quantitative_parameters
  for all to public using (app_private.is_admin()) with check (app_private.is_admin());

do $quantitative_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.quantitative_parameters to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.quantitative_parameters to service_role;
  end if;
end
$quantitative_grants$;

commit;

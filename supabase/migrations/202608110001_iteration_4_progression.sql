-- Iteration 4 progression and reviewed content coverage. PostgreSQL 15+.
begin;

alter type public.entity_kind add value if not exists 'ditto_move';

alter table public.quests alter column repeatable drop not null;
alter table public.quests alter column repeatable drop default;

create type public.content_scope as enum ('base_game', 'expansion', 'unknown');
create type public.classification_status as enum ('verified', 'candidate', 'unknown');

create table public.entity_content_classifications (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  scope public.content_scope not null default 'unknown',
  status public.classification_status not null default 'unknown',
  reason text not null check (btrim(reason) <> ''),
  assertion_id uuid references public.source_assertions(id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((status = 'unknown') = (scope = 'unknown'))
);

alter table public.treasure_maps
  add column map_number integer,
  add column area_name text,
  add column location_description text,
  add column reward_item_id uuid references public.items(id) on delete restrict,
  add column recipe_unlock_id uuid references public.recipes(id) on delete restrict;
alter table public.treasure_maps
  add constraint treasure_maps_number_positive check (map_number is null or map_number > 0);
create unique index treasure_maps_number_unique on public.treasure_maps(map_number)
  where map_number is not null;
create index treasure_maps_reward_item_id_idx on public.treasure_maps(reward_item_id);
create index treasure_maps_recipe_unlock_id_idx on public.treasure_maps(recipe_unlock_id);

create table public.treasure_map_requirements (
  treasure_map_id uuid not null references public.treasure_maps(id) on delete cascade,
  requirement_entity_id uuid not null references public.entities(id) on delete restrict,
  requirement_kind text not null check (requirement_kind in ('item', 'specialty')),
  primary key (treasure_map_id, requirement_entity_id)
);
create index treasure_map_requirements_entity_idx
  on public.treasure_map_requirements(requirement_entity_id);

alter table public.collectibles
  add column collectible_type text,
  add column catalog_number integer,
  add column description text,
  add column location_description text,
  add column origin_game text;
alter table public.collectibles
  add constraint collectibles_catalog_number_positive
  check (catalog_number is null or catalog_number > 0);
create unique index collectibles_type_number_unique
  on public.collectibles(collectible_type, catalog_number)
  where collectible_type is not null and catalog_number is not null;

create table public.ditto_moves (
  id uuid primary key references public.entities(id) on delete cascade,
  move_class text not null check (move_class in ('primary', 'secondary')),
  effect text not null,
  unlock_description text not null,
  meal_name text,
  meal_effect text,
  check ((meal_name is null) = (meal_effect is null))
);
create table public.ditto_move_pokemon (
  ditto_move_id uuid not null references public.ditto_moves(id) on delete cascade,
  pokemon_id uuid not null references public.pokemon(id) on delete restrict,
  primary key (ditto_move_id, pokemon_id)
);
create index ditto_move_pokemon_pokemon_idx on public.ditto_move_pokemon(pokemon_id);

alter table public.entity_content_classifications enable row level security;
alter table public.treasure_map_requirements enable row level security;
alter table public.ditto_moves enable row level security;
alter table public.ditto_move_pokemon enable row level security;

create policy catalog_read on public.entity_content_classifications
  for select to public using (true);
create policy catalog_read on public.treasure_map_requirements
  for select to public using (true);
create policy catalog_read on public.ditto_moves
  for select to public using (true);
create policy catalog_read on public.ditto_move_pokemon
  for select to public using (true);

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on public.entity_content_classifications, public.treasure_map_requirements,
      public.ditto_moves, public.ditto_move_pokemon to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on public.entity_content_classifications, public.treasure_map_requirements,
      public.ditto_moves, public.ditto_move_pokemon to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.entity_content_classifications, public.treasure_map_requirements,
      public.ditto_moves, public.ditto_move_pokemon to service_role;
  end if;
end
$grants$;

commit;

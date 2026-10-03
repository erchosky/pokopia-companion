-- Pokopia Companion canonical schema. PostgreSQL 15+; no Supabase-specific types.
begin;

create schema if not exists app_private;

create type public.verification_status as enum (
  'official', 'confirmed', 'community_confirmed', 'inferred', 'unverified',
  'conflicting', 'unknown', 'needs_testing'
);
create type public.knowledge_kind as enum ('fact', 'inference', 'recommendation');
create type public.assertion_lifecycle as enum ('candidate', 'accepted', 'rejected', 'superseded');
create type public.source_kind as enum ('official', 'publisher', 'community', 'manual_test', 'internal');
create type public.entity_kind as enum (
  'game', 'game_version', 'patch', 'dlc', 'content_pack', 'event',
  'pokemon', 'pokemon_form', 'ability', 'specialty', 'habitat',
  'region', 'zone', 'town', 'location', 'biome',
  'item', 'recipe', 'crafting_station', 'building', 'furniture', 'facility', 'structure',
  'automation_system', 'automation_component', 'crop', 'plant', 'berry',
  'production_system', 'quest', 'treasure_map', 'collectible', 'achievement'
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (btrim(name) <> ''),
  publisher text,
  released_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_versions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  version text not null check (btrim(version) <> ''),
  ordinal integer not null check (ordinal >= 0),
  released_at timestamptz,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, version),
  unique (game_id, ordinal)
);
create unique index game_versions_one_current_per_game
  on public.game_versions(game_id) where is_current;

create table public.patches (
  id uuid primary key default gen_random_uuid(),
  game_version_id uuid not null unique references public.game_versions(id) on delete cascade,
  title text not null,
  notes_url text,
  released_at timestamptz
);
create table public.dlcs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  released_at timestamptz,
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique (game_id, slug),
  check (introduced_version_id is null or introduced_version_id <> removed_version_id)
);
create table public.content_packs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  dlc_id uuid references public.dlcs(id) on delete set null,
  slug text not null,
  name text not null,
  kind text not null default 'content',
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique (game_id, slug)
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  content_pack_id uuid references public.content_packs(id) on delete set null,
  slug text not null,
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  recurrence_rule text,
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique (game_id, slug),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  kind public.entity_kind not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (btrim(display_name) <> ''),
  summary text,
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, kind, slug),
  check (introduced_version_id is null or introduced_version_id <> removed_version_id)
);

-- Release/content rows keep their operational keys while participating in the entity graph.
alter table public.patches add column entity_id uuid unique references public.entities(id) on delete cascade;
alter table public.dlcs add column entity_id uuid unique references public.entities(id) on delete cascade;
alter table public.content_packs add column entity_id uuid unique references public.entities(id) on delete cascade;
alter table public.events add column entity_id uuid unique references public.entities(id) on delete cascade;

-- Taxonomy is shared but remains relational; entity aliases are searchable names, not facts.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete restrict,
  scope text not null,
  slug text not null,
  name text not null,
  unique (game_id, scope, slug)
);
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  unique (game_id, slug)
);
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  unique (game_id, slug)
);
create table public.aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  alias text not null,
  locale text not null default 'en',
  alias_kind text not null default 'source',
  is_preferred boolean not null default false,
  unique (entity_id, locale, alias)
);
create table public.synonyms (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  term text not null,
  synonym text not null,
  locale text not null default 'en',
  unique (game_id, locale, term, synonym)
);
create table public.entity_tags (
  entity_id uuid not null references public.entities(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (entity_id, tag_id)
);

-- Pokémon.
create table public.pokemon (
  id uuid primary key references public.entities(id) on delete cascade,
  national_dex_number integer check (national_dex_number > 0),
  is_unique boolean not null default false
);
create table public.pokemon_forms (
  id uuid primary key references public.entities(id) on delete cascade,
  pokemon_id uuid not null references public.pokemon(id) on delete cascade,
  form_key text not null,
  is_default boolean not null default false,
  unique (pokemon_id, form_key)
);
create unique index pokemon_forms_one_default on public.pokemon_forms(pokemon_id) where is_default;
create table public.pokemon_aliases (
  pokemon_id uuid not null references public.pokemon(id) on delete cascade,
  alias_id uuid not null references public.aliases(id) on delete cascade,
  primary key (pokemon_id, alias_id)
);
create table public.abilities (
  id uuid primary key references public.entities(id) on delete cascade,
  description text
);
create table public.specialties (
  id uuid primary key references public.entities(id) on delete cascade,
  description text
);
create table public.habitats (
  id uuid primary key references public.entities(id) on delete cascade,
  description text
);
create table public.pokemon_roles (
  id uuid primary key default gen_random_uuid(),
  pokemon_id uuid not null references public.pokemon(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  effectiveness numeric(6,3) check (effectiveness between 0 and 1),
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique nulls not distinct (pokemon_id, role_id, introduced_version_id)
);
create table public.pokemon_abilities (
  id uuid primary key default gen_random_uuid(),
  pokemon_form_id uuid not null references public.pokemon_forms(id) on delete cascade,
  ability_id uuid not null references public.abilities(id) on delete cascade,
  slot text not null default 'primary',
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique nulls not distinct (pokemon_form_id, ability_id, slot, introduced_version_id)
);
create table public.pokemon_specialties (
  id uuid primary key default gen_random_uuid(),
  pokemon_id uuid not null references public.pokemon(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id) on delete cascade,
  proficiency numeric(6,3) check (proficiency between 0 and 1),
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique nulls not distinct (pokemon_id, specialty_id, introduced_version_id)
);
create table public.pokemon_habitats (
  id uuid primary key default gen_random_uuid(),
  pokemon_id uuid not null references public.pokemon(id) on delete cascade,
  habitat_id uuid not null references public.habitats(id) on delete cascade,
  is_preferred boolean not null default false,
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique nulls not distinct (pokemon_id, habitat_id, introduced_version_id)
);

-- World.
create table public.regions (
  id uuid primary key references public.entities(id) on delete cascade
);
create table public.zones (
  id uuid primary key references public.entities(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete restrict
);
create table public.biomes (
  id uuid primary key references public.entities(id) on delete cascade,
  description text
);
create table public.locations (
  id uuid primary key references public.entities(id) on delete cascade,
  zone_id uuid references public.zones(id) on delete restrict,
  parent_location_id uuid references public.locations(id) on delete restrict,
  biome_id uuid references public.biomes(id) on delete restrict,
  location_type text not null default 'area'
);
create table public.towns (
  id uuid primary key references public.entities(id) on delete cascade,
  location_id uuid references public.locations(id) on delete restrict,
  max_residents integer check (max_residents is null or max_residents >= 0)
);
create table public.environment_levels (
  id uuid primary key default gen_random_uuid(),
  town_id uuid not null references public.towns(id) on delete cascade,
  level integer not null check (level >= 0),
  name text,
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique nulls not distinct (town_id, level, introduced_version_id)
);
create table public.pokemon_locations (
  id uuid primary key default gen_random_uuid(),
  pokemon_id uuid not null references public.pokemon(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  availability text,
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique nulls not distinct (pokemon_id, location_id, introduced_version_id)
);

-- Items and item specializations.
create table public.item_categories (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  parent_id uuid references public.item_categories(id) on delete restrict,
  slug text not null,
  name text not null,
  unique (game_id, slug)
);
create table public.items (
  id uuid primary key references public.entities(id) on delete cascade,
  item_category_id uuid references public.item_categories(id) on delete restrict,
  stack_limit integer check (stack_limit is null or stack_limit > 0),
  is_tradeable boolean
);
create table public.item_variants (
  id uuid primary key references public.entities(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  variant_key text not null,
  unique (item_id, variant_key)
);
create table public.materials (
  item_id uuid primary key references public.items(id) on delete cascade,
  material_class text
);
create table public.resources (
  item_id uuid primary key references public.items(id) on delete cascade,
  renewable boolean
);
create table public.storage_types (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  capacity integer check (capacity is null or capacity >= 0),
  unique (game_id, slug)
);
create table public.containers (
  item_id uuid primary key references public.items(id) on delete cascade,
  storage_type_id uuid references public.storage_types(id) on delete restrict,
  capacity integer check (capacity is null or capacity >= 0)
);
create table public.tools (
  item_id uuid primary key references public.items(id) on delete cascade,
  tool_type text not null,
  durability integer check (durability is null or durability >= 0)
);
create table public.key_items (
  item_id uuid primary key references public.items(id) on delete cascade,
  purpose text
);
create table public.consumables (
  item_id uuid primary key references public.items(id) on delete cascade,
  max_uses integer check (max_uses is null or max_uses > 0)
);
create table public.item_sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  source_entity_id uuid not null references public.entities(id) on delete cascade,
  method text not null,
  quantity_min numeric check (quantity_min is null or quantity_min >= 0),
  quantity_max numeric check (quantity_max is null or quantity_max >= quantity_min),
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique nulls not distinct (item_id, source_entity_id, method, introduced_version_id)
);
create table public.material_sources (
  material_item_id uuid not null references public.materials(item_id) on delete cascade,
  source_entity_id uuid not null references public.entities(id) on delete cascade,
  method text not null,
  primary key (material_item_id, source_entity_id, method)
);

-- Crafting.
create table public.crafting_stations (
  id uuid primary key references public.entities(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null
);
create table public.recipes (
  id uuid primary key references public.entities(id) on delete cascade,
  crafting_station_id uuid references public.crafting_stations(id) on delete restrict,
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  batch_size numeric not null default 1 check (batch_size > 0)
);
create table public.recipe_ingredients (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  is_consumed boolean not null default true,
  group_key text not null default 'required',
  primary key (recipe_id, item_id, group_key)
);
create table public.recipe_outputs (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  probability numeric(7,6) not null default 1 check (probability between 0 and 1),
  primary key (recipe_id, item_id)
);

-- Building.
create table public.building_categories (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  unique (game_id, slug)
);
create table public.buildings (
  id uuid primary key references public.entities(id) on delete cascade,
  category_id uuid references public.building_categories(id) on delete restrict,
  footprint_width integer check (footprint_width is null or footprint_width > 0),
  footprint_height integer check (footprint_height is null or footprint_height > 0)
);
create table public.furniture (
  id uuid primary key references public.entities(id) on delete cascade,
  category_id uuid references public.categories(id) on delete restrict,
  footprint_width integer check (footprint_width is null or footprint_width > 0),
  footprint_height integer check (footprint_height is null or footprint_height > 0)
);
create table public.furniture_variants (
  id uuid primary key references public.entities(id) on delete cascade,
  furniture_id uuid not null references public.furniture(id) on delete cascade,
  variant_key text not null,
  unique (furniture_id, variant_key)
);
create table public.facilities (
  id uuid primary key references public.entities(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  facility_type text not null
);
create table public.structures (
  id uuid primary key references public.entities(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  structure_type text not null
);
create table public.construction_methods (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  unique (game_id, slug)
);

-- Farming and production.
create table public.crops (
  id uuid primary key references public.entities(id) on delete cascade,
  harvest_item_id uuid references public.items(id) on delete restrict,
  growth_seconds numeric check (growth_seconds is null or growth_seconds >= 0)
);
create table public.plants (
  id uuid primary key references public.entities(id) on delete cascade,
  harvest_item_id uuid references public.items(id) on delete restrict,
  regrows boolean
);
create table public.berries (
  id uuid primary key references public.entities(id) on delete cascade,
  item_id uuid references public.items(id) on delete restrict,
  growth_seconds numeric check (growth_seconds is null or growth_seconds >= 0)
);
create table public.production_systems (
  id uuid primary key references public.entities(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  cycle_seconds numeric check (cycle_seconds is null or cycle_seconds >= 0)
);
create table public.production_inputs (
  production_system_id uuid not null references public.production_systems(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  primary key (production_system_id, item_id)
);
create table public.production_outputs (
  production_system_id uuid not null references public.production_systems(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  primary key (production_system_id, item_id)
);
create table public.cycle_times (
  id uuid primary key default gen_random_uuid(),
  production_system_id uuid not null references public.production_systems(id) on delete cascade,
  condition_label text not null default 'default',
  seconds numeric not null check (seconds >= 0),
  unique (production_system_id, condition_label)
);
create table public.watering_methods (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  unique (game_id, slug)
);
create table public.harvesting_methods (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  unique (game_id, slug)
);

-- Automation.
create table public.automation_systems (
  id uuid primary key references public.entities(id) on delete cascade,
  cycle_seconds numeric check (cycle_seconds is null or cycle_seconds >= 0)
);
create table public.automation_components (
  id uuid primary key references public.entities(id) on delete cascade,
  item_id uuid references public.items(id) on delete restrict,
  component_type text not null
);
create table public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_system_id uuid not null references public.automation_systems(id) on delete cascade,
  step_order integer not null check (step_order >= 0),
  name text not null,
  actor_entity_id uuid references public.entities(id) on delete restrict,
  unique (automation_system_id, step_order)
);
create table public.automation_inputs (
  automation_system_id uuid not null references public.automation_systems(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  primary key (automation_system_id, item_id)
);
create table public.automation_outputs (
  automation_system_id uuid not null references public.automation_systems(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  primary key (automation_system_id, item_id)
);
create table public.automation_compatible_locations (
  automation_system_id uuid not null references public.automation_systems(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  primary key (automation_system_id, location_id)
);
create table public.automation_pokemon_roles (
  automation_system_id uuid not null references public.automation_systems(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  min_count integer not null default 1 check (min_count > 0),
  primary key (automation_system_id, role_id)
);
create table public.automation_limitations (
  id uuid primary key default gen_random_uuid(),
  automation_system_id uuid not null references public.automation_systems(id) on delete cascade,
  limitation text not null,
  severity text not null default 'constraint'
);

-- Progression and rule engine. Requirements are reusable and composable.
create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  condition_type text not null,
  operator text not null check (operator in ('eq','neq','gt','gte','lt','lte','contains','exists')),
  subject_entity_id uuid references public.entities(id) on delete cascade,
  comparison_entity_id uuid references public.entities(id) on delete restrict,
  comparison_text text,
  comparison_number numeric,
  comparison_boolean boolean,
  check (num_nonnulls(comparison_entity_id, comparison_text, comparison_number, comparison_boolean) <= 1)
);
create table public.condition_groups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  combinator text not null check (combinator in ('all','any','none')),
  label text
);
create table public.condition_requirements (
  condition_group_id uuid not null references public.condition_groups(id) on delete cascade,
  condition_id uuid not null references public.conditions(id) on delete cascade,
  position integer not null default 0,
  primary key (condition_group_id, condition_id)
);
create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  condition_group_id uuid not null references public.condition_groups(id) on delete cascade,
  name text not null,
  description text
);
create table public.effects (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  effect_type text not null,
  magnitude numeric,
  unit text,
  description text
);
create table public.effect_targets (
  effect_id uuid not null references public.effects(id) on delete cascade,
  target_entity_id uuid not null references public.entities(id) on delete cascade,
  primary key (effect_id, target_entity_id)
);
create table public.prerequisites (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  prerequisite_entity_id uuid not null references public.entities(id) on delete restrict,
  requirement_id uuid references public.requirements(id) on delete restrict,
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique nulls not distinct (entity_id, prerequisite_entity_id, introduced_version_id),
  check (entity_id <> prerequisite_entity_id)
);
create table public.dependencies (
  entity_id uuid not null references public.entities(id) on delete cascade,
  depends_on_entity_id uuid not null references public.entities(id) on delete restrict,
  dependency_type text not null,
  primary key (entity_id, depends_on_entity_id, dependency_type),
  check (entity_id <> depends_on_entity_id)
);
create table public.unlock_rules (
  id uuid primary key default gen_random_uuid(),
  unlocked_entity_id uuid not null references public.entities(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete restrict,
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  unique nulls not distinct (unlocked_entity_id, requirement_id, introduced_version_id)
);

create table public.pokemon_requirements (pokemon_id uuid not null references public.pokemon(id) on delete cascade, requirement_id uuid not null references public.requirements(id) on delete cascade, primary key (pokemon_id, requirement_id));
create table public.pokemon_unlocks (pokemon_id uuid not null references public.pokemon(id) on delete cascade, unlock_rule_id uuid not null references public.unlock_rules(id) on delete cascade, primary key (pokemon_id, unlock_rule_id));
create table public.pokemon_preferences (pokemon_id uuid not null references public.pokemon(id) on delete cascade, preferred_entity_id uuid not null references public.entities(id) on delete cascade, preference_strength numeric(6,3) check (preference_strength between -1 and 1), primary key (pokemon_id, preferred_entity_id));
create table public.pokemon_effects (pokemon_id uuid not null references public.pokemon(id) on delete cascade, effect_id uuid not null references public.effects(id) on delete cascade, primary key (pokemon_id, effect_id));
create table public.pokemon_synergies (pokemon_id uuid not null references public.pokemon(id) on delete cascade, other_pokemon_id uuid not null references public.pokemon(id) on delete cascade, effect_id uuid references public.effects(id) on delete restrict, rationale text, primary key (pokemon_id, other_pokemon_id), check (pokemon_id < other_pokemon_id));
create table public.town_unlocks (town_id uuid not null references public.towns(id) on delete cascade, unlock_rule_id uuid not null references public.unlock_rules(id) on delete cascade, primary key (town_id, unlock_rule_id));
create table public.town_resources (town_id uuid not null references public.towns(id) on delete cascade, item_id uuid not null references public.items(id) on delete restrict, abundance numeric(6,3) check (abundance between 0 and 1), primary key (town_id, item_id));
create table public.town_facilities (town_id uuid not null references public.towns(id) on delete cascade, facility_id uuid not null references public.facilities(id) on delete cascade, primary key (town_id, facility_id));
create table public.town_requirements (town_id uuid not null references public.towns(id) on delete cascade, requirement_id uuid not null references public.requirements(id) on delete cascade, primary key (town_id, requirement_id));
create table public.item_unlocks (item_id uuid not null references public.items(id) on delete cascade, unlock_rule_id uuid not null references public.unlock_rules(id) on delete cascade, primary key (item_id, unlock_rule_id));
create table public.recipe_requirements (recipe_id uuid not null references public.recipes(id) on delete cascade, requirement_id uuid not null references public.requirements(id) on delete cascade, primary key (recipe_id, requirement_id));
create table public.building_requirements (building_id uuid not null references public.buildings(id) on delete cascade, requirement_id uuid not null references public.requirements(id) on delete cascade, primary key (building_id, requirement_id));
create table public.building_effects (building_id uuid not null references public.buildings(id) on delete cascade, effect_id uuid not null references public.effects(id) on delete cascade, primary key (building_id, effect_id));
create table public.building_construction_methods (building_id uuid not null references public.buildings(id) on delete cascade, construction_method_id uuid not null references public.construction_methods(id) on delete cascade, primary key (building_id, construction_method_id));
create table public.automation_requirements (automation_system_id uuid not null references public.automation_systems(id) on delete cascade, requirement_id uuid not null references public.requirements(id) on delete cascade, primary key (automation_system_id, requirement_id));
create table public.automation_effects (automation_system_id uuid not null references public.automation_systems(id) on delete cascade, effect_id uuid not null references public.effects(id) on delete cascade, primary key (automation_system_id, effect_id));

create table public.quests (
  id uuid primary key references public.entities(id) on delete cascade,
  repeatable boolean not null default false,
  giver_entity_id uuid references public.entities(id) on delete set null
);
create table public.quest_steps (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  step_order integer not null check (step_order >= 0),
  description text not null,
  requirement_id uuid references public.requirements(id) on delete restrict,
  unique (quest_id, step_order)
);
create table public.quest_requirements (quest_id uuid not null references public.quests(id) on delete cascade, requirement_id uuid not null references public.requirements(id) on delete cascade, primary key (quest_id, requirement_id));
create table public.progression_nodes (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null unique references public.entities(id) on delete cascade,
  node_type text not null,
  sequence_number integer,
  requirement_id uuid references public.requirements(id) on delete restrict
);
create table public.treasure_maps (id uuid primary key references public.entities(id) on delete cascade, location_id uuid references public.locations(id) on delete restrict);
create table public.collectibles (id uuid primary key references public.entities(id) on delete cascade, item_id uuid references public.items(id) on delete restrict, location_id uuid references public.locations(id) on delete restrict);
create table public.achievements (id uuid primary key references public.entities(id) on delete cascade, requirement_id uuid references public.requirements(id) on delete restrict, points integer check (points is null or points >= 0));
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  unique (game_id, slug)
);
create table public.checklist_entries (
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  position integer not null default 0,
  primary key (checklist_id, entity_id)
);

-- Explainable scoring. Stored observations are derived artifacts, never canonical facts.
create table public.scoring_models (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slug text not null,
  name text not null,
  version integer not null check (version > 0),
  description text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, slug, version)
);
create table public.scoring_criteria (
  id uuid primary key default gen_random_uuid(),
  scoring_model_id uuid not null references public.scoring_models(id) on delete cascade,
  key text not null,
  label text not null,
  direction smallint not null default 1 check (direction in (-1, 1)),
  unique (scoring_model_id, key)
);
create table public.scoring_weights (
  id uuid primary key default gen_random_uuid(),
  scoring_model_id uuid not null references public.scoring_models(id) on delete cascade,
  criterion_id uuid not null references public.scoring_criteria(id) on delete cascade,
  context_entity_id uuid references public.entities(id) on delete cascade,
  preset text not null default 'balanced',
  weight numeric not null,
  unique nulls not distinct (scoring_model_id, criterion_id, preset, context_entity_id)
);
create table public.score_observations (
  id uuid primary key default gen_random_uuid(),
  scoring_model_id uuid not null references public.scoring_models(id) on delete cascade,
  subject_entity_id uuid not null references public.entities(id) on delete cascade,
  context_entity_id uuid references public.entities(id) on delete cascade,
  game_version_id uuid not null references public.game_versions(id) on delete restrict,
  preset text not null default 'balanced',
  total_score numeric not null,
  input_hash text not null,
  calculated_at timestamptz not null default now(),
  unique nulls not distinct (scoring_model_id, subject_entity_id, context_entity_id, game_version_id, preset, input_hash)
);
create table public.score_explanations (
  score_observation_id uuid not null references public.score_observations(id) on delete cascade,
  criterion_id uuid not null references public.scoring_criteria(id) on delete restrict,
  raw_value numeric not null,
  normalized_value numeric not null,
  weight numeric not null,
  contribution numeric not null,
  explanation text not null,
  primary key (score_observation_id, criterion_id)
);

-- Provenance and knowledge. Exactly one typed assertion value is required.
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.source_kind not null,
  base_url text,
  publisher text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  snapshot_key text not null,
  captured_at timestamptz not null,
  content_hash text not null,
  parser_version text,
  manifest_path text,
  created_at timestamptz not null default now(),
  unique (source_id, snapshot_key),
  unique (source_id, content_hash)
);
create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.source_snapshots(id) on delete cascade,
  source_url text,
  canonical_url text,
  document_path text not null,
  media_type text not null,
  content_hash text not null,
  title text,
  captured_at timestamptz,
  parser_version text,
  extraction_status text not null default 'pending',
  extraction_metadata jsonb not null default '{}'::jsonb,
  unique (snapshot_id, document_path)
);
create table public.source_assertions (
  id uuid primary key default gen_random_uuid(),
  subject_entity_id uuid not null references public.entities(id) on delete cascade,
  predicate text not null check (predicate ~ '^[a-z][a-z0-9_.-]*$'),
  object_entity_id uuid references public.entities(id) on delete restrict,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_json jsonb,
  unit text,
  kind public.knowledge_kind not null,
  lifecycle public.assertion_lifecycle not null default 'candidate',
  verification_status public.verification_status not null default 'unverified',
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  introduced_version_id uuid references public.game_versions(id),
  removed_version_id uuid references public.game_versions(id),
  verified_version_id uuid references public.game_versions(id),
  verified_at timestamptz,
  supersedes_assertion_id uuid references public.source_assertions(id) on delete restrict,
  assertion_hash text not null unique,
  created_at timestamptz not null default now(),
  check (num_nonnulls(object_entity_id, value_text, value_number, value_boolean, value_json) = 1),
  check (kind <> 'fact' or verification_status <> 'inferred')
);
create table public.source_evidence (
  id uuid primary key default gen_random_uuid(),
  assertion_id uuid not null references public.source_assertions(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete restrict,
  locator text,
  excerpt text,
  evidence_hash text,
  supports boolean not null default true,
  created_at timestamptz not null default now(),
  unique nulls not distinct (assertion_id, source_document_id, locator)
);
create table public.source_conflicts (
  id uuid primary key default gen_random_uuid(),
  left_assertion_id uuid not null references public.source_assertions(id) on delete cascade,
  right_assertion_id uuid not null references public.source_assertions(id) on delete cascade,
  status text not null default 'open',
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (left_assertion_id, right_assertion_id),
  check (left_assertion_id < right_assertion_id)
);
create table public.source_verifications (
  id uuid primary key default gen_random_uuid(),
  assertion_id uuid not null references public.source_assertions(id) on delete cascade,
  status public.verification_status not null,
  game_version_id uuid references public.game_versions(id),
  method text not null,
  notes text,
  verifier_user_id uuid,
  verified_at timestamptz not null default now()
);
create table public.facts (
  assertion_id uuid primary key references public.source_assertions(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  accepted_by_user_id uuid
);
create table public.assertions (
  assertion_id uuid primary key references public.source_assertions(id) on delete cascade
);
create table public.relationships (
  assertion_id uuid primary key references public.source_assertions(id) on delete cascade,
  subject_entity_id uuid not null references public.entities(id) on delete cascade,
  predicate text not null,
  object_entity_id uuid not null references public.entities(id) on delete restrict
);
create table public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  subject_entity_id uuid references public.entities(id) on delete cascade,
  question text not null,
  status public.verification_status not null check (status in ('unknown','conflicting','needs_testing','unverified')),
  priority smallint not null default 2 check (priority between 0 and 3),
  discovered_at timestamptz not null default now(),
  resolved_assertion_id uuid references public.source_assertions(id) on delete restrict
);
create table public.research_tasks (
  id uuid primary key default gen_random_uuid(),
  knowledge_gap_id uuid not null references public.knowledge_gaps(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  assigned_user_id uuid,
  due_at timestamptz,
  completed_at timestamptz
);

-- Search projection. It can be rebuilt; canonical identity remains in entities.
create table public.search_entries (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  locale text not null default 'en',
  title text not null,
  body text not null default '',
  aliases_text text not null default '',
  document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(aliases_text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'C')
  ) stored,
  updated_at timestamptz not null default now()
);

create index entities_game_kind_idx on public.entities(game_id, kind);
create index entities_slug_idx on public.entities(slug);
create index aliases_lookup_idx on public.aliases(lower(alias));
create index source_documents_url_idx on public.source_documents(canonical_url);
create index source_documents_hash_idx on public.source_documents(content_hash);
create index source_assertions_subject_predicate_idx on public.source_assertions(subject_entity_id, predicate);
create index source_assertions_status_idx on public.source_assertions(lifecycle, verification_status);
create index source_evidence_document_idx on public.source_evidence(source_document_id);
create index knowledge_gaps_status_idx on public.knowledge_gaps(status, priority);
create index search_entries_document_idx on public.search_entries using gin(document);
create index item_sources_source_idx on public.item_sources(source_entity_id);
create index pokemon_locations_location_idx on public.pokemon_locations(location_id);

create function app_private.set_updated_at() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger games_set_updated_at before update on public.games
  for each row execute function app_private.set_updated_at();
create trigger entities_set_updated_at before update on public.entities
  for each row execute function app_private.set_updated_at();
create trigger search_entries_set_updated_at before update on public.search_entries
  for each row execute function app_private.set_updated_at();

commit;

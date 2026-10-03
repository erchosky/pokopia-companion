do $verify$
declare missing_rls integer;
declare introduced_is_not_null boolean;
begin
  select count(*) into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing_rls <> 0 then
    raise exception '% public tables do not have RLS enabled', missing_rls;
  end if;
  if to_regclass('public.source_assertions') is null
    or to_regclass('public.user_entity_progress') is null
    or to_regclass('public.staging_records') is null
    or to_regclass('public.quantitative_parameters') is null then
    raise exception 'Required schema layer is missing';
  end if;
  select attnotnull into introduced_is_not_null
  from pg_attribute
  where attrelid = 'public.pokemon_roles'::regclass
    and attname = 'introduced_version_id';
  if introduced_is_not_null then
    raise exception 'Nullable unknown-baseline version was accidentally made mandatory';
  end if;
  if (select attnotnull from pg_attribute
      where attrelid = 'public.recipes'::regclass and attname = 'batch_size') then
    raise exception 'Unknown recipe batch size was accidentally made mandatory';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_entity_progress'
      and policyname = 'user_owns_rows'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'staging_records'
      and policyname = 'administrators_only'
  ) then
    raise exception 'Expected user/admin RLS policy is missing';
  end if;
end
$verify$;
select 'pokopia_schema_ok';

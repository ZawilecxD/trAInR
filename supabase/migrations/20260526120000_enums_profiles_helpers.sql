-- F-01 Phase 1: enums, profiles, auth sync trigger, RLS helpers (profiles-only), profiles RLS

-- ---------------------------------------------------------------------------
-- Enum types (MVP; used by tables in later migrations)
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('trainer', 'client');

create type public.exercise_type as enum (
  'strength',
  'cardio',
  'flexibility',
  'other'
);

create type public.exercise_metric as enum ('reps_weight', 'time', 'distance');

create type public.muscle_region as enum (
  'upper_body',
  'lower_body',
  'core',
  'full_body'
);

create type public.muscle_role as enum ('primary', 'secondary');

create type public.exercise_phase as enum ('warm_up', 'main', 'cool_down');

create type public.trainer_client_status as enum ('active', 'removed');

create type public.client_plan_status as enum ('active', 'completed', 'archived');

create type public.session_status as enum (
  'not_started',
  'finished',
  'finished_partially'
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'App user profile; id matches auth.users.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: provision profile on signup (SECURITY DEFINER; bypasses profiles RLS)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
  resolved_role public.user_role;
begin
  meta_role := new.raw_user_meta_data ->> 'role';

  if meta_role in ('trainer', 'client') then
    resolved_role := meta_role::public.user_role;
  else
    resolved_role := 'trainer'::public.user_role;
  end if;

  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    resolved_role,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'User'
    )
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from authenticated, anon;
grant execute on function public.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper: current user's role (SECURITY INVOKER; own row visible via RLS)
-- is_trainer_for_client / is_assigned_trainer ship in phase-2 migration
-- (they reference trainer_clients).
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security invoker
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

grant execute on function public.current_user_role() to authenticated;

-- ---------------------------------------------------------------------------
-- profiles RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

grant select, update on table public.profiles to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

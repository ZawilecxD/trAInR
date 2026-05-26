-- F-01 Phase 2b: muscle_groups, exercises, exercise_muscle_groups + RLS

-- ---------------------------------------------------------------------------
-- muscle_groups — seeded lookup (see supabase/seed.sql)
-- ---------------------------------------------------------------------------

create table public.muscle_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  region public.muscle_region not null
);

comment on table public.muscle_groups is 'Canonical muscle catalog for FR-009 filtering.';

-- ---------------------------------------------------------------------------
-- exercises — per-trainer library
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  exercise_type public.exercise_type not null,
  default_metric public.exercise_metric not null,
  notes text,
  video_url text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercises_trainer_id_idx on public.exercises (trainer_id);

create trigger exercises_set_updated_at
before update on public.exercises
for each row
execute function public.set_updated_at();

comment on table public.exercises is 'Trainer-owned exercise library; clients use session_exercises snapshots.';

-- ---------------------------------------------------------------------------
-- exercise_muscle_groups — junction (exercise ↔ muscle, with role)
-- ---------------------------------------------------------------------------

create table public.exercise_muscle_groups (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  muscle_group_id uuid not null references public.muscle_groups (id) on delete restrict,
  role public.muscle_role not null,
  primary key (exercise_id, muscle_group_id, role)
);

create index exercise_muscle_groups_muscle_group_id_idx
on public.exercise_muscle_groups (muscle_group_id);

-- ---------------------------------------------------------------------------
-- muscle_groups RLS — read-only for authenticated
-- ---------------------------------------------------------------------------

alter table public.muscle_groups enable row level security;

grant select on table public.muscle_groups to authenticated;

create policy "muscle_groups_select_authenticated"
on public.muscle_groups
for select
to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- exercises RLS — trainer owns rows; no client access in MVP
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;

grant select, insert, update, delete on table public.exercises to authenticated;

create policy "exercises_trainer_select"
on public.exercises
for select
to authenticated
using (trainer_id = auth.uid());

create policy "exercises_trainer_insert"
on public.exercises
for insert
to authenticated
with check (trainer_id = auth.uid());

create policy "exercises_trainer_update"
on public.exercises
for update
to authenticated
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());

create policy "exercises_trainer_delete"
on public.exercises
for delete
to authenticated
using (trainer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- exercise_muscle_groups RLS — read all; writes only for owning trainer
-- ---------------------------------------------------------------------------

alter table public.exercise_muscle_groups enable row level security;

grant select, insert, update, delete on table public.exercise_muscle_groups to authenticated;

create policy "exercise_muscle_groups_select_authenticated"
on public.exercise_muscle_groups
for select
to authenticated
using (true);

create policy "exercise_muscle_groups_trainer_insert"
on public.exercise_muscle_groups
for insert
to authenticated
with check (
  exists (
    select 1
    from public.exercises e
    where e.id = exercise_id
      and e.trainer_id = auth.uid()
  )
);

create policy "exercise_muscle_groups_trainer_update"
on public.exercise_muscle_groups
for update
to authenticated
using (
  exists (
    select 1
    from public.exercises e
    where e.id = exercise_id
      and e.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.exercises e
    where e.id = exercise_id
      and e.trainer_id = auth.uid()
  )
);

create policy "exercise_muscle_groups_trainer_delete"
on public.exercise_muscle_groups
for delete
to authenticated
using (
  exists (
    select 1
    from public.exercises e
    where e.id = exercise_id
      and e.trainer_id = auth.uid()
  )
);

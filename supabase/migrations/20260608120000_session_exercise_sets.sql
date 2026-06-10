-- S-04 Phase 1: per-round session exercise prescription
-- ---------------------------------------------------------------------------

create table public.session_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  set_number integer not null,
  prescribed_reps integer,
  prescribed_duration_seconds integer,
  prescribed_load_kg numeric(10, 2),
  rest_after_seconds integer,
  constraint session_exercise_sets_set_number_positive check (set_number > 0),
  constraint session_exercise_sets_reps_or_duration check (
    prescribed_reps is not null or prescribed_duration_seconds is not null
  ),
  unique (session_exercise_id, set_number)
);

comment on table public.session_exercise_sets is 'Per-round prescription for a session exercise snapshot.';

create index session_exercise_sets_session_exercise_id_idx
  on public.session_exercise_sets (session_exercise_id);

-- ---------------------------------------------------------------------------
-- Backfill: expand flat prescription into one row per set
-- ---------------------------------------------------------------------------

insert into public.session_exercise_sets (
  session_exercise_id,
  set_number,
  prescribed_reps,
  prescribed_duration_seconds,
  prescribed_load_kg,
  rest_after_seconds
)
select
  se.id,
  gs,
  se.prescribed_reps,
  se.prescribed_duration_seconds,
  se.prescribed_load_kg,
  se.rest_after_seconds
from public.session_exercises se
cross join lateral generate_series(1, greatest(se.prescribed_sets, 1)) as gs;

-- ---------------------------------------------------------------------------
-- Drop flat prescription columns from session_exercises
-- ---------------------------------------------------------------------------

alter table public.session_exercises
  drop column prescribed_sets,
  drop column prescribed_reps,
  drop column prescribed_duration_seconds,
  drop column prescribed_load_kg,
  drop column rest_after_seconds;

-- ---------------------------------------------------------------------------
-- RLS: session_exercise_sets — via session_exercises → workout_sessions → client_plans
-- ---------------------------------------------------------------------------

alter table public.session_exercise_sets enable row level security;

grant select, insert, update, delete on table public.session_exercise_sets to authenticated;

create policy "session_exercise_sets_select_via_session_exercise"
on public.session_exercise_sets
for select
to authenticated
using (public.can_access_session_exercise(session_exercise_id));

create policy "session_exercise_sets_trainer_insert"
on public.session_exercise_sets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    join public.client_plans cp on cp.id = ws.client_plan_id
    where se.id = session_exercise_id
      and cp.trainer_id = auth.uid()
      and public.is_trainer_for_client(cp.client_id)
  )
);

create policy "session_exercise_sets_trainer_update"
on public.session_exercise_sets
for update
to authenticated
using (
  exists (
    select 1
    from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    join public.client_plans cp on cp.id = ws.client_plan_id
    where se.id = session_exercise_id
      and cp.trainer_id = auth.uid()
      and public.is_trainer_for_client(cp.client_id)
  )
)
with check (
  exists (
    select 1
    from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    join public.client_plans cp on cp.id = ws.client_plan_id
    where se.id = session_exercise_id
      and cp.trainer_id = auth.uid()
      and public.is_trainer_for_client(cp.client_id)
  )
);

create policy "session_exercise_sets_trainer_delete"
on public.session_exercise_sets
for delete
to authenticated
using (
  exists (
    select 1
    from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    join public.client_plans cp on cp.id = ws.client_plan_id
    where se.id = session_exercise_id
      and cp.trainer_id = auth.uid()
      and public.is_trainer_for_client(cp.client_id)
  )
);

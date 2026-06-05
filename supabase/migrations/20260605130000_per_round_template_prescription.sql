-- S-14 Phase 1: per-round template exercise prescription
-- ---------------------------------------------------------------------------

create table public.template_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  template_exercise_id uuid not null references public.template_exercises (id) on delete cascade,
  set_number integer not null,
  prescribed_reps integer,
  prescribed_duration_seconds integer,
  prescribed_load_kg numeric(10, 2),
  rest_after_seconds integer,
  constraint template_exercise_sets_set_number_positive check (set_number > 0),
  unique (template_exercise_id, set_number)
);

comment on table public.template_exercise_sets is 'Per-round prescription for a template exercise.';

create index template_exercise_sets_template_exercise_id_idx
  on public.template_exercise_sets (template_exercise_id);

-- ---------------------------------------------------------------------------
-- Backfill: expand flat prescription into one row per set
-- ---------------------------------------------------------------------------

insert into public.template_exercise_sets (
  template_exercise_id,
  set_number,
  prescribed_reps,
  prescribed_duration_seconds,
  prescribed_load_kg,
  rest_after_seconds
)
select
  te.id,
  gs,
  te.prescribed_reps,
  te.prescribed_duration_seconds,
  te.prescribed_load_kg,
  te.rest_after_seconds
from public.template_exercises te
cross join lateral generate_series(1, greatest(te.prescribed_sets, 1)) as gs;

-- ---------------------------------------------------------------------------
-- Drop flat prescription columns from template_exercises
-- ---------------------------------------------------------------------------

alter table public.template_exercises
  drop column prescribed_sets,
  drop column prescribed_reps,
  drop column prescribed_duration_seconds,
  drop column prescribed_load_kg,
  drop column rest_after_seconds;

-- ---------------------------------------------------------------------------
-- RLS: template_exercise_sets — derived via template_exercises → session_templates
-- ---------------------------------------------------------------------------

alter table public.template_exercise_sets enable row level security;

grant select, insert, update, delete on table public.template_exercise_sets to authenticated;

create policy "template_exercise_sets_select_trainer_template_owner"
on public.template_exercise_sets
for select
to authenticated
using (
  exists (
    select 1
    from public.template_exercises te
    join public.session_templates st on st.id = te.template_id
    where te.id = template_exercise_sets.template_exercise_id
      and st.trainer_id = auth.uid()
  )
);

create policy "template_exercise_sets_insert_trainer_template_owner"
on public.template_exercise_sets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.template_exercises te
    join public.session_templates st on st.id = te.template_id
    where te.id = template_exercise_sets.template_exercise_id
      and st.trainer_id = auth.uid()
  )
);

create policy "template_exercise_sets_update_trainer_template_owner"
on public.template_exercise_sets
for update
to authenticated
using (
  exists (
    select 1
    from public.template_exercises te
    join public.session_templates st on st.id = te.template_id
    where te.id = template_exercise_sets.template_exercise_id
      and st.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.template_exercises te
    join public.session_templates st on st.id = te.template_id
    where te.id = template_exercise_sets.template_exercise_id
      and st.trainer_id = auth.uid()
  )
);

create policy "template_exercise_sets_delete_trainer_template_owner"
on public.template_exercise_sets
for delete
to authenticated
using (
  exists (
    select 1
    from public.template_exercises te
    join public.session_templates st on st.id = te.template_id
    where te.id = template_exercise_sets.template_exercise_id
      and st.trainer_id = auth.uid()
  )
);

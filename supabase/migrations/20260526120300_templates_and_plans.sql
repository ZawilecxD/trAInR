-- F-01 Phase 3: session_templates, client_plans, and client-visible plan isolation
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- session_templates — reusable single-session blueprint (owned by trainer)
-- ---------------------------------------------------------------------------

create table public.session_templates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.session_templates is 'Reusable session blueprint owned by a trainer.';

create index session_templates_trainer_id_idx on public.session_templates (trainer_id);

create trigger session_templates_set_updated_at
before update on public.session_templates
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: session_templates — trainer full access; clients none
-- ---------------------------------------------------------------------------

alter table public.session_templates enable row level security;

grant select, insert, update, delete on table public.session_templates to authenticated;

create policy "session_templates_trainer_select_own"
on public.session_templates
for select
to authenticated
using (trainer_id = auth.uid());

create policy "session_templates_trainer_insert_own"
on public.session_templates
for insert
to authenticated
with check (trainer_id = auth.uid());

create policy "session_templates_trainer_update_own"
on public.session_templates
for update
to authenticated
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());

create policy "session_templates_trainer_delete_own"
on public.session_templates
for delete
to authenticated
using (trainer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- template_exercises — ordered exercises within a template
-- ---------------------------------------------------------------------------

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.session_templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  phase public.exercise_phase not null,
  sort_order integer not null,
  prescribed_sets integer not null,
  prescribed_reps integer,
  prescribed_duration_seconds integer,
  prescribed_load_kg numeric(10, 2),
  rest_after_seconds integer,
  notes text
);

comment on table public.template_exercises is 'Exercises snapshot list inside a session template.';

create index template_exercises_template_id_idx on public.template_exercises (template_id);
create index template_exercises_exercise_id_idx on public.template_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- RLS: template_exercises — derived via session_templates ownership
-- ---------------------------------------------------------------------------

alter table public.template_exercises enable row level security;

grant select, insert, update, delete on table public.template_exercises to authenticated;

create policy "template_exercises_select_trainer_template_owner"
on public.template_exercises
for select
to authenticated
using (
  exists (
    select 1
    from public.session_templates st
    where st.id = template_exercises.template_id
      and st.trainer_id = auth.uid()
  )
);

create policy "template_exercises_insert_trainer_template_owner"
on public.template_exercises
for insert
to authenticated
with check (
  exists (
    select 1
    from public.session_templates st
    where st.id = template_exercises.template_id
      and st.trainer_id = auth.uid()
  )
  and exists (
    select 1
    from public.exercises e
    where e.id = template_exercises.exercise_id
      and e.trainer_id = auth.uid()
  )
);

create policy "template_exercises_update_trainer_template_owner"
on public.template_exercises
for update
to authenticated
using (
  exists (
    select 1
    from public.session_templates st
    where st.id = template_exercises.template_id
      and st.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.session_templates st
    where st.id = template_exercises.template_id
      and st.trainer_id = auth.uid()
  )
  and exists (
    select 1
    from public.exercises e
    where e.id = template_exercises.exercise_id
      and e.trainer_id = auth.uid()
  )
);

create policy "template_exercises_delete_trainer_template_owner"
on public.template_exercises
for delete
to authenticated
using (
  exists (
    select 1
    from public.session_templates st
    where st.id = template_exercises.template_id
      and st.trainer_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- client_plans — one-active-plan per client at a time
-- ---------------------------------------------------------------------------

create table public.client_plans (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  status public.client_plan_status not null default 'active',
  start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.client_plans is 'Client plan container; at most one active plan per client.';

create index client_plans_trainer_id_idx on public.client_plans (trainer_id);
create index client_plans_client_id_idx on public.client_plans (client_id);

-- One active plan per client (soft-archive retains history for clients)
create unique index client_plans_one_active_per_client_idx
on public.client_plans (client_id)
where status = 'active'::public.client_plan_status;

create trigger client_plans_set_updated_at
before update on public.client_plans
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: client_plans — trainer manages; client can read own plans
-- ---------------------------------------------------------------------------

alter table public.client_plans enable row level security;

grant select, insert, update, delete on table public.client_plans to authenticated;

create policy "client_plans_trainer_select_own"
on public.client_plans
for select
to authenticated
using (trainer_id = auth.uid());

create policy "client_plans_trainer_insert_active_for_assigned_client"
on public.client_plans
for insert
to authenticated
with check (
  trainer_id = auth.uid()
  and status = 'active'::public.client_plan_status
  and public.is_trainer_for_client(client_id)
);

create policy "client_plans_trainer_update_own"
on public.client_plans
for update
to authenticated
using (trainer_id = auth.uid())
with check (
  trainer_id = auth.uid()
  and (
    status <> 'active'::public.client_plan_status
    or public.is_trainer_for_client(client_id)
  )
);

create policy "client_plans_trainer_delete_own"
on public.client_plans
for delete
to authenticated
using (trainer_id = auth.uid());

-- Client can see own history; for active plans we additionally require
-- they are currently assigned to that trainer (soft removal retains history).
create policy "client_plans_client_select_own_history"
on public.client_plans
for select
to authenticated
using (
  client_id = auth.uid()
  and (
    status <> 'active'::public.client_plan_status
    or public.is_assigned_trainer(trainer_id)
  )
);


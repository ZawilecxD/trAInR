-- F-01 Phase 4: workout_sessions, session_exercises, set_logs, session_comments + RLS audit
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RLS helpers — plan/session graph (reuse client_plans visibility rules)
-- ---------------------------------------------------------------------------

create or replace function public.can_access_client_plan(p_plan_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.client_plans cp
    where cp.id = p_plan_id
      and (
        cp.trainer_id = auth.uid()
        or (
          cp.client_id = auth.uid()
          and (
            cp.status <> 'active'::public.client_plan_status
            or public.is_assigned_trainer(cp.trainer_id)
          )
        )
      )
  );
$$;

comment on function public.can_access_client_plan(uuid) is
  'True when auth.uid() may read/write rows tied to this client_plan (trainer owner or assigned client).';

grant execute on function public.can_access_client_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- workout_sessions — calendar session on a client plan
-- ---------------------------------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_plan_id uuid not null references public.client_plans (id) on delete cascade,
  source_template_id uuid references public.session_templates (id) on delete set null,
  scheduled_date date not null,
  name text,
  status public.session_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.workout_sessions is
  'Scheduled workout on a plan; session_exercises snapshot template rows at creation.';

comment on column public.workout_sessions.locked_at is
  'T3: when set, S-13 will deny set_logs UPDATE; column only in F-01.';

create index workout_sessions_client_plan_id_idx on public.workout_sessions (client_plan_id);
create index workout_sessions_source_template_id_idx on public.workout_sessions (source_template_id);
create index workout_sessions_scheduled_date_idx on public.workout_sessions (scheduled_date);

-- ---------------------------------------------------------------------------
-- session_exercises — per-session exercise snapshot
-- ---------------------------------------------------------------------------

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
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

comment on table public.session_exercises is
  'Exercise prescription snapshot for one workout session (denormalized from template).';

create index session_exercises_session_id_idx on public.session_exercises (session_id);
create index session_exercises_exercise_id_idx on public.session_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- set_logs — one row per logged set
-- ---------------------------------------------------------------------------

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  set_number integer not null,
  is_warmup boolean not null default false,
  reps integer,
  duration_seconds integer,
  load_kg numeric(10, 2),
  logged_at timestamptz not null default now(),
  constraint set_logs_set_number_positive check (set_number > 0)
);

comment on table public.set_logs is
  'Per-set performance log; is_warmup defaults false (T2 semantics).';

create index set_logs_session_exercise_id_idx on public.set_logs (session_exercise_id);

-- ---------------------------------------------------------------------------
-- session_comments — bidirectional session feedback (T2 table, F-01 RLS)
-- ---------------------------------------------------------------------------

create table public.session_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

comment on table public.session_comments is 'Trainer/client comments on a workout session.';

create index session_comments_session_id_idx on public.session_comments (session_id);
create index session_comments_author_id_idx on public.session_comments (author_id);

create trigger session_comments_set_updated_at
before update on public.session_comments
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers — session graph (after tables exist)
-- ---------------------------------------------------------------------------

create or replace function public.can_access_workout_session(p_session_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_sessions ws
    where ws.id = p_session_id
      and public.can_access_client_plan(ws.client_plan_id)
  );
$$;

comment on function public.can_access_workout_session(uuid) is
  'True when auth.uid() may access this workout session via its client_plan.';

create or replace function public.can_access_session_exercise(p_session_exercise_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.session_exercises se
    where se.id = p_session_exercise_id
      and public.can_access_workout_session(se.session_id)
  );
$$;

comment on function public.can_access_session_exercise(uuid) is
  'True when auth.uid() may access this session_exercise row via workout_sessions → client_plans.';

grant execute on function public.can_access_workout_session(uuid) to authenticated;
grant execute on function public.can_access_session_exercise(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: workout_sessions
-- ---------------------------------------------------------------------------

alter table public.workout_sessions enable row level security;

grant select, insert, update, delete on table public.workout_sessions to authenticated;

create policy "workout_sessions_select_via_plan"
on public.workout_sessions
for select
to authenticated
using (public.can_access_client_plan(client_plan_id));

create policy "workout_sessions_trainer_insert"
on public.workout_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.client_plans cp
    where cp.id = client_plan_id
      and cp.trainer_id = auth.uid()
      and (
        cp.status <> 'active'::public.client_plan_status
        or public.is_trainer_for_client(cp.client_id)
      )
  )
  and (
    source_template_id is null
    or exists (
      select 1
      from public.session_templates st
      where st.id = source_template_id
        and st.trainer_id = auth.uid()
    )
  )
);

create policy "workout_sessions_trainer_update"
on public.workout_sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.client_plans cp
    where cp.id = client_plan_id
      and cp.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.client_plans cp
    where cp.id = client_plan_id
      and cp.trainer_id = auth.uid()
  )
  and (
    source_template_id is null
    or exists (
      select 1
      from public.session_templates st
      where st.id = source_template_id
        and st.trainer_id = auth.uid()
    )
  )
);

create policy "workout_sessions_trainer_delete"
on public.workout_sessions
for delete
to authenticated
using (
  exists (
    select 1
    from public.client_plans cp
    where cp.id = client_plan_id
      and cp.trainer_id = auth.uid()
  )
);

create policy "workout_sessions_client_update"
on public.workout_sessions
for update
to authenticated
using (public.can_access_client_plan(client_plan_id))
with check (
  exists (
    select 1
    from public.client_plans cp
    where cp.id = client_plan_id
      and cp.client_id = auth.uid()
      and (
        cp.status <> 'active'::public.client_plan_status
        or public.is_assigned_trainer(cp.trainer_id)
      )
  )
);

-- ---------------------------------------------------------------------------
-- RLS: session_exercises
-- ---------------------------------------------------------------------------

alter table public.session_exercises enable row level security;

grant select, insert, update, delete on table public.session_exercises to authenticated;

create policy "session_exercises_select_via_session"
on public.session_exercises
for select
to authenticated
using (public.can_access_workout_session(session_id));

create policy "session_exercises_trainer_insert"
on public.session_exercises
for insert
to authenticated
with check (
  public.can_access_workout_session(session_id)
  and exists (
    select 1
    from public.workout_sessions ws
    join public.client_plans cp on cp.id = ws.client_plan_id
    where ws.id = session_id
      and cp.trainer_id = auth.uid()
  )
  and exists (
    select 1
    from public.exercises e
    join public.client_plans cp on cp.trainer_id = e.trainer_id
    join public.workout_sessions ws on ws.client_plan_id = cp.id
    where e.id = exercise_id
      and ws.id = session_id
      and e.trainer_id = auth.uid()
  )
);

create policy "session_exercises_trainer_update"
on public.session_exercises
for update
to authenticated
using (
  exists (
    select 1
    from public.workout_sessions ws
    join public.client_plans cp on cp.id = ws.client_plan_id
    where ws.id = session_id
      and cp.trainer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_sessions ws
    join public.client_plans cp on cp.id = ws.client_plan_id
    where ws.id = session_id
      and cp.trainer_id = auth.uid()
  )
  and exists (
    select 1
    from public.exercises e
    where e.id = exercise_id
      and e.trainer_id = auth.uid()
  )
);

create policy "session_exercises_trainer_delete"
on public.session_exercises
for delete
to authenticated
using (
  exists (
    select 1
    from public.workout_sessions ws
    join public.client_plans cp on cp.id = ws.client_plan_id
    where ws.id = session_id
      and cp.trainer_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- RLS: set_logs (trainer read; client read/write on assigned sessions)
-- ---------------------------------------------------------------------------

alter table public.set_logs enable row level security;

grant select, insert, update on table public.set_logs to authenticated;

create policy "set_logs_select_via_session_exercise"
on public.set_logs
for select
to authenticated
using (public.can_access_session_exercise(session_exercise_id));

create policy "set_logs_client_insert"
on public.set_logs
for insert
to authenticated
with check (
  public.can_access_session_exercise(session_exercise_id)
  and exists (
    select 1
    from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    join public.client_plans cp on cp.id = ws.client_plan_id
    where se.id = session_exercise_id
      and cp.client_id = auth.uid()
      and (
        cp.status <> 'active'::public.client_plan_status
        or public.is_assigned_trainer(cp.trainer_id)
      )
  )
);

create policy "set_logs_client_update"
on public.set_logs
for update
to authenticated
using (
  public.can_access_session_exercise(session_exercise_id)
  and exists (
    select 1
    from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    join public.client_plans cp on cp.id = ws.client_plan_id
    where se.id = session_exercise_id
      and cp.client_id = auth.uid()
      and (
        cp.status <> 'active'::public.client_plan_status
        or public.is_assigned_trainer(cp.trainer_id)
      )
  )
)
with check (
  public.can_access_session_exercise(session_exercise_id)
  and exists (
    select 1
    from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    join public.client_plans cp on cp.id = ws.client_plan_id
    where se.id = session_exercise_id
      and cp.client_id = auth.uid()
      and (
        cp.status <> 'active'::public.client_plan_status
        or public.is_assigned_trainer(cp.trainer_id)
      )
  )
);

-- ---------------------------------------------------------------------------
-- RLS: session_comments
-- ---------------------------------------------------------------------------

alter table public.session_comments enable row level security;

grant select, insert, update, delete on table public.session_comments to authenticated;

create policy "session_comments_select_via_session"
on public.session_comments
for select
to authenticated
using (public.can_access_workout_session(session_id));

create policy "session_comments_insert_author"
on public.session_comments
for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.can_access_workout_session(session_id)
);

create policy "session_comments_update_own"
on public.session_comments
for update
to authenticated
using (author_id = auth.uid())
with check (
  author_id = auth.uid()
  and public.can_access_workout_session(session_id)
);

create policy "session_comments_delete_own"
on public.session_comments
for delete
to authenticated
using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- F-01 RLS audit — all 13 MVP public tables must have RLS enabled
-- profiles, trainer_clients, invite_links, muscle_groups, exercises,
-- exercise_muscle_groups, session_templates, template_exercises, client_plans,
-- workout_sessions, session_exercises, set_logs, session_comments
-- (verified by migration apply + automated query in implement phase)
-- ---------------------------------------------------------------------------

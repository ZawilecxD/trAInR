-- S-11 Phase 1: remove_trainer_client RPC + RLS tightening for post-removal trainer isolation

-- ---------------------------------------------------------------------------
-- remove_trainer_client — archive active plans, soft-remove assignment
-- ---------------------------------------------------------------------------

create or replace function public.remove_trainer_client(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  select tc.client_id
  into v_client_id
  from public.trainer_clients tc
  where tc.id = p_assignment_id
    and tc.trainer_id = auth.uid()
    and tc.status = 'active'::public.trainer_client_status;

  if v_client_id is null then
    raise exception 'Assignment not found or already removed';
  end if;

  update public.client_plans
  set
    status = 'archived'::public.client_plan_status,
    updated_at = now()
  where trainer_id = auth.uid()
    and client_id = v_client_id
    and status = 'active'::public.client_plan_status;

  update public.trainer_clients
  set
    status = 'removed'::public.trainer_client_status,
    removed_at = now()
  where id = p_assignment_id;
end;
$$;

comment on function public.remove_trainer_client(uuid) is
  'Soft-remove trainer–client assignment; archive active client_plans for the pair. SECURITY DEFINER: trainer SELECT is active-only, so INVOKER cannot UPDATE status to removed (PG requires SELECT on new row).';

revoke all on function public.remove_trainer_client(uuid) from public;
grant execute on function public.remove_trainer_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS helper — trainer access requires active assignment
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
        (
          cp.trainer_id = auth.uid()
          and public.is_trainer_for_client(cp.client_id)
        )
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

-- ---------------------------------------------------------------------------
-- client_plans — trainer policies require active assignment
-- ---------------------------------------------------------------------------

drop policy if exists "client_plans_trainer_select_own" on public.client_plans;

create policy "client_plans_trainer_select_own"
on public.client_plans
for select
to authenticated
using (
  trainer_id = auth.uid()
  and public.is_trainer_for_client(client_id)
);

drop policy if exists "client_plans_trainer_update_own" on public.client_plans;

create policy "client_plans_trainer_update_own"
on public.client_plans
for update
to authenticated
using (
  trainer_id = auth.uid()
  and public.is_trainer_for_client(client_id)
)
with check (
  trainer_id = auth.uid()
  and (
    status <> 'active'::public.client_plan_status
    or public.is_trainer_for_client(client_id)
  )
);

drop policy if exists "client_plans_trainer_delete_own" on public.client_plans;

create policy "client_plans_trainer_delete_own"
on public.client_plans
for delete
to authenticated
using (
  trainer_id = auth.uid()
  and public.is_trainer_for_client(client_id)
);

-- ---------------------------------------------------------------------------
-- workout_sessions — trainer mutate policies require active assignment
-- ---------------------------------------------------------------------------

drop policy if exists "workout_sessions_trainer_update" on public.workout_sessions;

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
      and public.is_trainer_for_client(cp.client_id)
  )
)
with check (
  exists (
    select 1
    from public.client_plans cp
    where cp.id = client_plan_id
      and cp.trainer_id = auth.uid()
      and public.is_trainer_for_client(cp.client_id)
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

drop policy if exists "workout_sessions_trainer_delete" on public.workout_sessions;

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
      and public.is_trainer_for_client(cp.client_id)
  )
);

-- ---------------------------------------------------------------------------
-- session_exercises — trainer mutate policies require active assignment
-- ---------------------------------------------------------------------------

drop policy if exists "session_exercises_trainer_update" on public.session_exercises;

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
      and public.is_trainer_for_client(cp.client_id)
  )
)
with check (
  exists (
    select 1
    from public.workout_sessions ws
    join public.client_plans cp on cp.id = ws.client_plan_id
    where ws.id = session_id
      and cp.trainer_id = auth.uid()
      and public.is_trainer_for_client(cp.client_id)
  )
  and exists (
    select 1
    from public.exercises e
    where e.id = exercise_id
      and e.trainer_id = auth.uid()
  )
);

drop policy if exists "session_exercises_trainer_delete" on public.session_exercises;

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
      and public.is_trainer_for_client(cp.client_id)
  )
);

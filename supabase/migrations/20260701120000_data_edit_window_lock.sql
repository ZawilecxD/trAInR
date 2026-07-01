-- S-13: 24h edit window then seal logged data (FR-022)
-- locked_at stores the UTC instant when editing seals (first set_log + 24h).

comment on column public.workout_sessions.locked_at is
  'UTC seal deadline: first set_log logged_at + 24h. Writes denied when now() >= locked_at.';

create or replace function public.is_workout_session_sealed(p_session_id uuid)
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
      and ws.locked_at is not null
      and ws.locked_at <= now()
  );
$$;

comment on function public.is_workout_session_sealed(uuid) is
  'True when workout_sessions.locked_at deadline has passed (S-13 / FR-022).';

grant execute on function public.is_workout_session_sealed(uuid) to authenticated;

drop policy if exists "set_logs_client_insert" on public.set_logs;
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
  and not public.is_workout_session_sealed(
    (
      select se.session_id
      from public.session_exercises se
      where se.id = session_exercise_id
    )
  )
);

drop policy if exists "set_logs_client_update" on public.set_logs;
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
  and not public.is_workout_session_sealed(
    (
      select se.session_id
      from public.session_exercises se
      where se.id = session_exercise_id
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
  and not public.is_workout_session_sealed(
    (
      select se.session_id
      from public.session_exercises se
      where se.id = session_exercise_id
    )
  )
);

drop policy if exists "set_logs_client_delete" on public.set_logs;
create policy "set_logs_client_delete"
on public.set_logs
for delete
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
  and not public.is_workout_session_sealed(
    (
      select se.session_id
      from public.session_exercises se
      where se.id = session_exercise_id
    )
  )
);

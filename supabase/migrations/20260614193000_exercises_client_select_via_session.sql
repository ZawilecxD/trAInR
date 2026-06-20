-- S-06 Phase 2: allow clients to read exercise names/metrics for assigned session snapshots

create policy "exercises_client_select_via_assigned_session"
on public.exercises
for select
to authenticated
using (
  exists (
    select 1
    from public.session_exercises se
    join public.workout_sessions ws on ws.id = se.session_id
    join public.client_plans cp on cp.id = ws.client_plan_id
    where se.exercise_id = exercises.id
      and cp.client_id = auth.uid()
      and (
        cp.status <> 'active'::public.client_plan_status
        or public.is_assigned_trainer(cp.trainer_id)
      )
  )
);

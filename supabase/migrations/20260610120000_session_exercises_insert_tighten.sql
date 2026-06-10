-- Align session_exercises INSERT policy with post-S-11 active-assignment requirement.

drop policy if exists "session_exercises_trainer_insert" on public.session_exercises;

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
      and public.is_trainer_for_client(cp.client_id)
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

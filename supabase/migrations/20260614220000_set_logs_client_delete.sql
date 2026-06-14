-- S-06: allow clients to delete set logs on assigned sessions (skip round / restart)

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
);

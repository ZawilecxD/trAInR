-- Q-02: ownership guard + search_path pin for replace_exercise_muscle_groups

create or replace function public.replace_exercise_muscle_groups(
  p_exercise_id uuid,
  p_muscle_groups jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.exercises e
    where e.id = p_exercise_id
      and e.trainer_id = auth.uid()
  ) then
    raise exception 'Exercise not found or not authorized';
  end if;

  delete from public.exercise_muscle_groups
  where exercise_id = p_exercise_id;

  if jsonb_array_length(p_muscle_groups) > 0 then
    insert into public.exercise_muscle_groups (exercise_id, muscle_group_id, role)
    select
      p_exercise_id,
      (item->>'muscle_group_id')::uuid,
      (item->>'role')::muscle_role
    from jsonb_array_elements(p_muscle_groups) as item;
  end if;
end;
$$;

comment on function public.replace_exercise_muscle_groups(uuid, jsonb) is
  'Replace all muscle group links for an exercise. SECURITY DEFINER: requires exercises.trainer_id = auth.uid().';

revoke all on function public.replace_exercise_muscle_groups(uuid, jsonb) from public;
grant execute on function public.replace_exercise_muscle_groups(uuid, jsonb) to authenticated;

create or replace function replace_exercise_muscle_groups(
  p_exercise_id uuid,
  p_muscle_groups jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  delete from exercise_muscle_groups
  where exercise_id = p_exercise_id;

  if jsonb_array_length(p_muscle_groups) > 0 then
    insert into exercise_muscle_groups (exercise_id, muscle_group_id, role)
    select
      p_exercise_id,
      (item->>'muscle_group_id')::uuid,
      (item->>'role')::muscle_role
    from jsonb_array_elements(p_muscle_groups) as item;
  end if;
end;
$$;

revoke all on function replace_exercise_muscle_groups from public;
grant execute on function replace_exercise_muscle_groups to authenticated;

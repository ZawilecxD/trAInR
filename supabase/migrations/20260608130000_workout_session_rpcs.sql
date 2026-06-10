-- S-04 Phase 2: workout session snapshot RPCs
-- ---------------------------------------------------------------------------
-- Exercise JSON shape for create/update:
-- [
--   {
--     "exercise_id": "uuid",
--     "phase": "main",
--     "sort_order": 0,
--     "notes": null,
--     "sets": [
--       {
--         "prescribed_reps": 10,
--         "prescribed_duration_seconds": null,
--         "prescribed_load_kg": 50,
--         "rest_after_seconds": 120
--       }
--     ]
--   }
-- ]
-- ---------------------------------------------------------------------------

create or replace function public.ensure_active_client_plan(p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_trainer_for_client(p_client_id) then
    raise exception 'trainer is not assigned to this client';
  end if;

  select cp.id
  into v_plan_id
  from public.client_plans cp
  where cp.client_id = p_client_id
    and cp.trainer_id = auth.uid()
    and cp.status = 'active'::public.client_plan_status
  limit 1;

  if v_plan_id is not null then
    return v_plan_id;
  end if;

  insert into public.client_plans (trainer_id, client_id, name, status, start_date)
  values (
    auth.uid(),
    p_client_id,
    'Training plan',
    'active'::public.client_plan_status,
    current_date
  )
  on conflict (client_id) where (status = 'active'::public.client_plan_status)
  do nothing
  returning id into v_plan_id;

  if v_plan_id is null then
    select cp.id
    into v_plan_id
    from public.client_plans cp
    where cp.client_id = p_client_id
      and cp.trainer_id = auth.uid()
      and cp.status = 'active'::public.client_plan_status
    limit 1;
  end if;

  if v_plan_id is null then
    if exists (
      select 1
      from public.client_plans cp
      where cp.client_id = p_client_id
        and cp.status = 'active'::public.client_plan_status
    ) then
      raise exception 'client already has an active plan with another trainer';
    end if;

    raise exception 'failed to ensure active client plan';
  end if;

  return v_plan_id;
end;
$$;

revoke all on function public.ensure_active_client_plan(uuid) from public;
grant execute on function public.ensure_active_client_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------

create or replace function public.create_workout_session(
  p_client_id uuid,
  p_scheduled_date date,
  p_name text,
  p_source_template_id uuid,
  p_exercises jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_session_id uuid;
  v_exercise jsonb;
  v_set jsonb;
  v_session_exercise_id uuid;
  v_set_number integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'session name is required';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' then
    raise exception 'exercises must be a json array';
  end if;

  v_plan_id := public.ensure_active_client_plan(p_client_id);

  if p_source_template_id is not null then
    if not exists (
      select 1
      from public.session_templates st
      where st.id = p_source_template_id
        and st.trainer_id = auth.uid()
    ) then
      raise exception 'template not found or not owned by trainer';
    end if;
  end if;

  for v_exercise in
    select value
    from jsonb_array_elements(p_exercises) as elements(value)
  loop
    if not exists (
      select 1
      from public.exercises e
      where e.id = (v_exercise->>'exercise_id')::uuid
        and e.trainer_id = auth.uid()
    ) then
      raise exception 'exercise not found or not owned by trainer';
    end if;

    if v_exercise->'sets' is null
      or jsonb_typeof(v_exercise->'sets') <> 'array'
      or jsonb_array_length(v_exercise->'sets') < 1 then
      raise exception 'each exercise needs at least one set';
    end if;

    if jsonb_array_length(v_exercise->'sets') > 20 then
      raise exception 'too many sets on exercise';
    end if;

    for v_set in
      select value
      from jsonb_array_elements(v_exercise->'sets') as sets(value)
    loop
      if (v_set->>'prescribed_reps') is null
        and (v_set->>'prescribed_duration_seconds') is null then
        raise exception 'each set needs reps or duration';
      end if;
    end loop;
  end loop;

  insert into public.workout_sessions (
    client_plan_id,
    scheduled_date,
    name,
    source_template_id,
    status
  )
  values (
    v_plan_id,
    p_scheduled_date,
    btrim(p_name),
    p_source_template_id,
    'not_started'::public.session_status
  )
  returning id into v_session_id;

  for v_exercise in
    select value
    from jsonb_array_elements(p_exercises) as elements(value)
  loop
    insert into public.session_exercises (
      session_id,
      exercise_id,
      phase,
      sort_order,
      notes
    )
    values (
      v_session_id,
      (v_exercise->>'exercise_id')::uuid,
      (v_exercise->>'phase')::public.exercise_phase,
      coalesce((v_exercise->>'sort_order')::integer, 0),
      case
        when v_exercise->'notes' is null or v_exercise->>'notes' = '' then null
        else v_exercise->>'notes'
      end
    )
    returning id into v_session_exercise_id;

    v_set_number := 0;
    for v_set in
      select value
      from jsonb_array_elements(v_exercise->'sets') as sets(value)
    loop
      v_set_number := v_set_number + 1;
      insert into public.session_exercise_sets (
        session_exercise_id,
        set_number,
        prescribed_reps,
        prescribed_duration_seconds,
        prescribed_load_kg,
        rest_after_seconds
      )
      values (
        v_session_exercise_id,
        v_set_number,
        (v_set->>'prescribed_reps')::integer,
        (v_set->>'prescribed_duration_seconds')::integer,
        (v_set->>'prescribed_load_kg')::numeric,
        (v_set->>'rest_after_seconds')::integer
      );
    end loop;
  end loop;

  return v_session_id;
end;
$$;

revoke all on function public.create_workout_session(uuid, date, text, uuid, jsonb) from public;
grant execute on function public.create_workout_session(uuid, date, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------

create or replace function public.update_workout_session_snapshot(
  p_session_id uuid,
  p_scheduled_date date,
  p_name text,
  p_exercises jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.session_status;
  v_started_at timestamptz;
  v_exercise jsonb;
  v_set jsonb;
  v_session_exercise_id uuid;
  v_set_number integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select ws.status, ws.started_at
  into v_status, v_started_at
  from public.workout_sessions ws
  join public.client_plans cp on cp.id = ws.client_plan_id
  where ws.id = p_session_id
    and cp.trainer_id = auth.uid()
    and public.is_trainer_for_client(cp.client_id);

  if not found then
    raise exception 'session not found or access denied';
  end if;

  if v_status <> 'not_started'::public.session_status or v_started_at is not null then
    raise exception 'session cannot be edited after client has started';
  end if;

  if p_name is not null and btrim(p_name) = '' then
    raise exception 'session name cannot be empty';
  end if;

  if p_exercises is not null then
    if jsonb_typeof(p_exercises) <> 'array' then
      raise exception 'exercises must be a json array';
    end if;

    for v_exercise in
      select value
      from jsonb_array_elements(p_exercises) as elements(value)
    loop
      if not exists (
        select 1
        from public.exercises e
        where e.id = (v_exercise->>'exercise_id')::uuid
          and e.trainer_id = auth.uid()
      ) then
        raise exception 'exercise not found or not owned by trainer';
      end if;

      if v_exercise->'sets' is null
        or jsonb_typeof(v_exercise->'sets') <> 'array'
        or jsonb_array_length(v_exercise->'sets') < 1 then
        raise exception 'each exercise needs at least one set';
      end if;

      if jsonb_array_length(v_exercise->'sets') > 20 then
        raise exception 'too many sets on exercise';
      end if;

      for v_set in
        select value
        from jsonb_array_elements(v_exercise->'sets') as sets(value)
      loop
        if (v_set->>'prescribed_reps') is null
          and (v_set->>'prescribed_duration_seconds') is null then
          raise exception 'each set needs reps or duration';
        end if;
      end loop;
    end loop;
  end if;

  if p_scheduled_date is not null or p_name is not null then
    update public.workout_sessions
    set
      scheduled_date = coalesce(p_scheduled_date, scheduled_date),
      name = coalesce(nullif(btrim(p_name), ''), name)
    where id = p_session_id;
  end if;

  if p_exercises is not null then
    delete from public.session_exercises
    where session_id = p_session_id;

    for v_exercise in
      select value
      from jsonb_array_elements(p_exercises) as elements(value)
    loop
      insert into public.session_exercises (
        session_id,
        exercise_id,
        phase,
        sort_order,
        notes
      )
      values (
        p_session_id,
        (v_exercise->>'exercise_id')::uuid,
        (v_exercise->>'phase')::public.exercise_phase,
        coalesce((v_exercise->>'sort_order')::integer, 0),
        case
          when v_exercise->'notes' is null or v_exercise->>'notes' = '' then null
          else v_exercise->>'notes'
        end
      )
      returning id into v_session_exercise_id;

      v_set_number := 0;
      for v_set in
        select value
        from jsonb_array_elements(v_exercise->'sets') as sets(value)
      loop
        v_set_number := v_set_number + 1;
        insert into public.session_exercise_sets (
          session_exercise_id,
          set_number,
          prescribed_reps,
          prescribed_duration_seconds,
          prescribed_load_kg,
          rest_after_seconds
        )
        values (
          v_session_exercise_id,
          v_set_number,
          (v_set->>'prescribed_reps')::integer,
          (v_set->>'prescribed_duration_seconds')::integer,
          (v_set->>'prescribed_load_kg')::numeric,
          (v_set->>'rest_after_seconds')::integer
        );
      end loop;
    end loop;
  end if;
end;
$$;

revoke all on function public.update_workout_session_snapshot(uuid, date, text, jsonb) from public;
grant execute on function public.update_workout_session_snapshot(uuid, date, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------

create or replace function public.delete_workout_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.session_status;
  v_started_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select ws.status, ws.started_at
  into v_status, v_started_at
  from public.workout_sessions ws
  join public.client_plans cp on cp.id = ws.client_plan_id
  where ws.id = p_session_id
    and cp.trainer_id = auth.uid()
    and public.is_trainer_for_client(cp.client_id);

  if not found then
    raise exception 'session not found or access denied';
  end if;

  if v_status <> 'not_started'::public.session_status or v_started_at is not null then
    raise exception 'session cannot be deleted after client has started';
  end if;

  delete from public.workout_sessions
  where id = p_session_id;
end;
$$;

revoke all on function public.delete_workout_session(uuid) from public;
grant execute on function public.delete_workout_session(uuid) to authenticated;

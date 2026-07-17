-- S-21 manual verification: optional RPE on set_logs
-- Run in Supabase Studio SQL Editor (local or linked project).
-- Uses transaction + rollback so no permanent changes.
--
-- Fixture UUIDs (scripts/seed-dev-users.sql):
--   client-A@gmail.com -> c2000001-0000-4000-8000-000000000002

begin;

-- ---------------------------------------------------------------------------
-- 1. Sanity: rpe column exists with range constraint
-- ---------------------------------------------------------------------------
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'set_logs'
  and column_name = 'rpe';

-- PASS: one row, data_type = smallint, is_nullable = YES
-- FAIL: no row — run migration 20260702120000_set_logs_rpe.sql

-- ---------------------------------------------------------------------------
-- 2. Pick a client session exercise to test (dev seed client-A)
-- ---------------------------------------------------------------------------
with target as (
  select se.id as session_exercise_id, cp.client_id
  from session_exercises se
  join workout_sessions ws on ws.id = se.session_id
  join client_plans cp on cp.id = ws.client_plan_id
  where cp.client_id = 'c2000001-0000-4000-8000-000000000002'
    and ws.status = 'not_started'
    and ws.started_at is not null
    and (
      cp.status <> 'active'
      or exists (
        select 1
        from trainer_clients tc
        where tc.trainer_id = cp.trainer_id
          and tc.client_id = cp.client_id
          and tc.status = 'active'
      )
    )
    and not public.is_workout_session_sealed(ws.id)
  order by ws.started_at desc nulls last
  limit 1
)
select session_exercise_id, client_id from target;

-- If no started uncompleted session, use any writable assigned session exercise:
with target as (
  select se.id as session_exercise_id, cp.client_id
  from session_exercises se
  join workout_sessions ws on ws.id = se.session_id
  join client_plans cp on cp.id = ws.client_plan_id
  where cp.client_id = 'c2000001-0000-4000-8000-000000000002'
    and (
      cp.status <> 'active'
      or exists (
        select 1
        from trainer_clients tc
        where tc.trainer_id = cp.trainer_id
          and tc.client_id = cp.client_id
          and tc.status = 'active'
      )
    )
    and not public.is_workout_session_sealed(ws.id)
  order by ws.scheduled_date desc
  limit 1
)
select session_exercise_id, client_id from target;

-- ---------------------------------------------------------------------------
-- 3. RLS: client can upsert rpe on own session (transaction-scoped JWT)
-- ---------------------------------------------------------------------------
do $$
declare
  v_session_exercise_id uuid;
  v_client_id uuid;
  v_log_id uuid;
begin
  select se.id, cp.client_id
  into v_session_exercise_id, v_client_id
  from session_exercises se
  join workout_sessions ws on ws.id = se.session_id
  join client_plans cp on cp.id = ws.client_plan_id
  where cp.client_id = 'c2000001-0000-4000-8000-000000000002'
    and (
      cp.status <> 'active'
      or exists (
        select 1
        from trainer_clients tc
        where tc.trainer_id = cp.trainer_id
          and tc.client_id = cp.client_id
          and tc.status = 'active'
      )
    )
    and not public.is_workout_session_sealed(ws.id)
  order by ws.scheduled_date desc
  limit 1;

  if v_session_exercise_id is null then
    raise exception 'No writable session exercise found for client-A@gmail.com — seed dev users and ensure the session is not sealed';
  end if;

  perform set_config('request.jwt.claim.sub', v_client_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_client_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  if auth.uid() is distinct from v_client_id then
    raise exception 'auth.uid() mismatch — expected %, got %', v_client_id, auth.uid();
  end if;

  insert into public.set_logs (
    session_exercise_id,
    set_number,
    reps,
    load_kg,
    rpe,
    is_complete,
    is_warmup
  )
  values (
    v_session_exercise_id,
    99,
    5,
    20,
    8,
    false,
    false
  )
  on conflict (session_exercise_id, set_number)
  do update set rpe = excluded.rpe, reps = excluded.reps, load_kg = excluded.load_kg
  returning id into v_log_id;

  raise notice 'PASS: upserted set log % with rpe=8', v_log_id;

  update public.set_logs set rpe = null where id = v_log_id;
  raise notice 'PASS: cleared rpe to null';

  delete from public.set_logs where id = v_log_id;
  raise notice 'PASS: deleted test set log';

  execute 'reset role';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Constraint: reject out-of-range rpe
-- ---------------------------------------------------------------------------
do $$
declare
  v_session_exercise_id uuid;
  v_client_id uuid;
begin
  select se.id, cp.client_id
  into v_session_exercise_id, v_client_id
  from session_exercises se
  join workout_sessions ws on ws.id = se.session_id
  join client_plans cp on cp.id = ws.client_plan_id
  where cp.client_id = 'c2000001-0000-4000-8000-000000000002'
    and (
      cp.status <> 'active'
      or exists (
        select 1
        from trainer_clients tc
        where tc.trainer_id = cp.trainer_id
          and tc.client_id = cp.client_id
          and tc.status = 'active'
      )
    )
    and not public.is_workout_session_sealed(ws.id)
  order by ws.scheduled_date desc
  limit 1;

  if v_session_exercise_id is null then
    raise exception 'No writable session exercise found for client-A@gmail.com — seed dev users and ensure the session is not sealed';
  end if;

  perform set_config('request.jwt.claim.sub', v_client_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_client_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  begin
    insert into public.set_logs (session_exercise_id, set_number, reps, rpe)
    values (v_session_exercise_id, 98, 5, 11);
    raise exception 'FAIL: rpe=11 should violate check constraint';
  exception
    when check_violation then
      raise notice 'PASS: rpe=11 rejected by check constraint';
  end;

  execute 'reset role';
end $$;

rollback;

-- Manual UI checks (after migration applied, outside this script):
-- 1. As client, open a started, uncompleted guided session.
-- 2. Log a set without RPE — saves normally.
-- 3. Log a set with RPE 7 — reload page, value persists.
-- 4. Complete session; summary table shows RPE column with 7 or "—".
-- 5. Trainer session detail shows same RPE values.
-- 6. After edit window seals, RPE inputs are read-only.

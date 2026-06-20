-- S-06 Phase 1 verification — check 1.6
--
-- Paste this entire script into Supabase Studio SQL Editor (local: http://localhost:54323).
-- Runs as a single transaction; all mutations roll back at the end.
--
-- Prerequisites:
--   npx supabase db reset
--   (or: migrations applied + npm run seed:dev-users)
--
-- Fixture UUIDs (scripts/seed-dev-users.sql):
--   trainer-A@gmail.com  -> c2000001-0000-4000-8000-000000000001
--   client-A@gmail.com   -> c2000001-0000-4000-8000-000000000002  (assigned to trainer A)
--   trainer-B@gmail.com  -> c2000001-0000-4000-8000-000000000003
--   client-B@gmail.com   -> c2000001-0000-4000-8000-000000000004  (assigned to trainer B)
--
-- Expected: every result row shows status = PASS.

begin;

-- ---------------------------------------------------------------------------
-- 0. Prerequisite — dev seed fixtures present
-- ---------------------------------------------------------------------------

select
  '0_dev_seed_client_a' as check_name,
  case
    when exists (
      select 1 from auth.users where id = 'c2000001-0000-4000-8000-000000000002'
    ) then 'present'
    else 'missing'
  end as observed,
  'present' as expected,
  case
    when exists (
      select 1 from auth.users where id = 'c2000001-0000-4000-8000-000000000002'
    ) then 'PASS'
    else 'FAIL — run: npx supabase db reset or npm run seed:dev-users'
  end as status;

-- ---------------------------------------------------------------------------
-- 1. Resolve fixtures (uses existing Client A data when present; rolled back)
-- ---------------------------------------------------------------------------

do $setup$
declare
  v_client_a uuid := 'c2000001-0000-4000-8000-000000000002';
  v_client_b uuid := 'c2000001-0000-4000-8000-000000000004';
  v_trainer_b uuid := 'c2000001-0000-4000-8000-000000000003';
  v_own_se uuid;
  v_foreign_se uuid;
  v_plan_b uuid;
  v_session_b uuid;
  v_exercise_b uuid := 'e2000001-0000-4000-8000-000000000004';
begin
  select se.id
  into v_own_se
  from public.session_exercises se
  join public.workout_sessions ws on ws.id = se.session_id
  join public.client_plans cp on cp.id = ws.client_plan_id
  where cp.client_id = v_client_a
  order by ws.scheduled_date desc
  limit 1;

  if v_own_se is null then
    raise exception 'No session exercise for client A — assign a session with exercises first';
  end if;

  insert into public.client_plans (trainer_id, client_id, name, status, start_date)
  values (v_trainer_b, v_client_b, 'Client B Verify Plan', 'active', current_date)
  returning id into v_plan_b;

  insert into public.workout_sessions (client_plan_id, scheduled_date, name, status)
  values (v_plan_b, current_date, 'Client B Verify Session', 'not_started')
  returning id into v_session_b;

  insert into public.session_exercises (session_id, exercise_id, phase, sort_order)
  values (v_session_b, v_exercise_b, 'main', 0)
  returning id into v_foreign_se;

  perform set_config('test.own_se', v_own_se::text, true);
  perform set_config('test.foreign_se', v_foreign_se::text, true);

  perform set_config(
    'test.set_number',
    (
      select coalesce(max(sl.set_number), 0) + 1
      from public.set_logs sl
      where sl.session_exercise_id = v_own_se
    )::text,
    true
  );
end;
$setup$;

select
  '1_fixture_session_exercises_resolved' as check_name,
  current_setting('test.own_se', true) as observed,
  'uuid' as expected,
  case
    when current_setting('test.own_se', true) is not null then 'PASS'
    else 'FAIL'
  end as status;

-- ---------------------------------------------------------------------------
-- 1.6a — Client A can INSERT set log on own session exercise
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p16a$
declare
  v_log_id uuid;
begin
  perform set_config(
    'test.check_p16a_auth_uid',
    coalesce(auth.uid()::text, 'null'),
    true
  );

  insert into public.set_logs (
    session_exercise_id,
    set_number,
    reps,
    load_kg,
    is_complete
  )
  values (
    current_setting('test.own_se')::uuid,
    current_setting('test.set_number')::integer,
    10,
    50,
    false
  )
  returning id into v_log_id;

  perform set_config('test.check_p16a_insert_id', coalesce(v_log_id::text, 'null'), true);
end;
$p16a$;

reset role;

select
  '1.6a_client_a_auth_uid' as check_name,
  current_setting('test.check_p16a_auth_uid', true) as observed,
  'c2000001-0000-4000-8000-000000000002' as expected,
  case
    when current_setting('test.check_p16a_auth_uid', true)
      = 'c2000001-0000-4000-8000-000000000002' then 'PASS'
    else 'FAIL'
  end as status;

select
  '1.6a_client_a_inserts_own_set_log' as check_name,
  current_setting('test.check_p16a_insert_id', true) as observed,
  'uuid' as expected,
  case
    when current_setting('test.check_p16a_insert_id', true) <> 'null' then 'PASS'
    else 'FAIL'
  end as status;

-- ---------------------------------------------------------------------------
-- 1.6b — Client A can UPDATE own set log (is_complete toggle)
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p16b$
declare
  v_updated_count integer;
begin
  update public.set_logs
  set is_complete = true, reps = 11
  where session_exercise_id = current_setting('test.own_se')::uuid
    and set_number = current_setting('test.set_number')::integer;

  get diagnostics v_updated_count = row_count;
  perform set_config('test.check_p16b_updated_count', v_updated_count::text, true);
end;
$p16b$;

reset role;

select
  '1.6b_client_a_updates_own_set_log' as check_name,
  current_setting('test.check_p16b_updated_count', true) as observed,
  '1' as expected,
  case
    when current_setting('test.check_p16b_updated_count', true) = '1' then 'PASS'
    else 'FAIL'
  end as status;

-- ---------------------------------------------------------------------------
-- 1.6c — Client A cannot INSERT on Client B session exercise
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p16c$
begin
  begin
    insert into public.set_logs (
      session_exercise_id,
      set_number,
      reps,
      is_complete
    )
    values (
      current_setting('test.foreign_se')::uuid,
      1,
      8,
      false
    );

    perform set_config('test.check_p16c_foreign_insert', 'allowed', true);
  exception
    when others then
      perform set_config('test.check_p16c_foreign_insert', 'denied', true);
  end;
end;
$p16c$;

reset role;

select
  '1.6c_client_a_cannot_insert_foreign_set_log' as check_name,
  current_setting('test.check_p16c_foreign_insert', true) as observed,
  'denied' as expected,
  case
    when current_setting('test.check_p16c_foreign_insert', true) = 'denied' then 'PASS'
    else 'FAIL'
  end as status;

-- ---------------------------------------------------------------------------
-- 1.6d — Upsert unique constraint prevents duplicate (session_exercise, set_number)
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p16d$
begin
  begin
    insert into public.set_logs (
      session_exercise_id,
      set_number,
      reps,
      is_complete
    )
    values (
      current_setting('test.own_se')::uuid,
      current_setting('test.set_number')::integer,
      99,
      false
    );

    perform set_config('test.check_p16d_duplicate_insert', 'allowed', true);
  exception
    when unique_violation then
      perform set_config('test.check_p16d_duplicate_insert', 'denied', true);
  end;
end;
$p16d$;

reset role;

select
  '1.6d_unique_constraint_blocks_duplicate_set' as check_name,
  current_setting('test.check_p16d_duplicate_insert', true) as observed,
  'denied' as expected,
  case
    when current_setting('test.check_p16d_duplicate_insert', true) = 'denied' then 'PASS'
    else 'FAIL'
  end as status;

rollback;

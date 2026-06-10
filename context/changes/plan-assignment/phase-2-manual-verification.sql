-- S-04 Phase 2 manual verification — checks 2.5, 2.6, 2.7
--
-- Paste this entire script into Supabase Studio SQL Editor (local: http://localhost:54323).
-- Runs as a single transaction; RPC-created rows roll back at the end.
--
-- Prerequisites:
--   npx supabase db reset
--   (or: migrations applied + npm run seed:dev-users)
--
-- Fixture UUIDs (scripts/seed-dev-users.sql):
--   trainer-A@gmail.com  -> c2000001-0000-4000-8000-000000000001
--   client-A@gmail.com   -> c2000001-0000-4000-8000-000000000002  (assigned to trainer A)
--   trainer-B@gmail.com  -> c2000001-0000-4000-8000-000000000003
--   Bench Press (trainer A) -> e2000001-0000-4000-8000-000000000001
--
-- Expected: every result row shows status = PASS.
-- Note: RPC calls run as `authenticated`; result SELECTs run as postgres (reset role)
-- so we never write to temp tables from the authenticated role.

begin;

-- ---------------------------------------------------------------------------
-- 0. Prerequisite — dev seed fixtures present
-- ---------------------------------------------------------------------------

select
  '0_dev_seed_trainer_a' as check_name,
  case
    when exists (
      select 1 from auth.users where id = 'c2000001-0000-4000-8000-000000000001'
    ) then 'present'
    else 'missing'
  end as observed,
  'present' as expected,
  case
    when exists (
      select 1 from auth.users where id = 'c2000001-0000-4000-8000-000000000001'
    ) then 'PASS'
    else 'FAIL — run: npx supabase db reset or npm run seed:dev-users'
  end as status;

select
  '0_dev_seed_assignment' as check_name,
  count(*)::text as observed,
  '1' as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.trainer_clients
where trainer_id = 'c2000001-0000-4000-8000-000000000001'
  and client_id = 'c2000001-0000-4000-8000-000000000002'
  and status = 'active';

select
  '0_dev_seed_exercise' as check_name,
  count(*)::text as observed,
  '1' as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.exercises
where id = 'e2000001-0000-4000-8000-000000000001'
  and trainer_id = 'c2000001-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 2.5 — create_workout_session creates session + exercises + sets atomically
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p25$
declare
  v_session_id uuid;
  v_exercises jsonb := $json$
[
  {
    "exercise_id": "e2000001-0000-4000-8000-000000000001",
    "phase": "main",
    "sort_order": 0,
    "notes": "Phase 2 manual verify",
    "sets": [
      {
        "prescribed_reps": 10,
        "prescribed_duration_seconds": null,
        "prescribed_load_kg": 60,
        "rest_after_seconds": 120
      },
      {
        "prescribed_reps": 8,
        "prescribed_duration_seconds": null,
        "prescribed_load_kg": 65,
        "rest_after_seconds": 150
      }
    ]
  }
]
$json$::jsonb;
begin
  perform set_config(
    'test.check_p25_auth_uid',
    coalesce(auth.uid()::text, 'null'),
    true
  );

  v_session_id := public.create_workout_session(
    'c2000001-0000-4000-8000-000000000002'::uuid,
    current_date + 7,
    'Phase 2 manual verify',
    null,
    v_exercises
  );

  perform set_config('test.session_id', v_session_id::text, true);
end;
$p25$;

reset role;

select
  '2.5_trainer_a_auth_uid' as check_name,
  current_setting('test.check_p25_auth_uid', true) as observed,
  'c2000001-0000-4000-8000-000000000001' as expected,
  case
    when current_setting('test.check_p25_auth_uid', true)
      = 'c2000001-0000-4000-8000-000000000001' then 'PASS'
    else 'FAIL'
  end as status;

select
  '2.5_workout_session_row' as check_name,
  count(*)::text as observed,
  '1' as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.workout_sessions
where id = current_setting('test.session_id', true)::uuid
  and name = 'Phase 2 manual verify'
  and status = 'not_started'
  and started_at is null;

select
  '2.5_session_exercises' as check_name,
  count(*)::text as observed,
  '1' as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.session_exercises
where session_id = current_setting('test.session_id', true)::uuid;

select
  '2.5_session_exercise_sets' as check_name,
  count(*)::text as observed,
  '2' as expected,
  case when count(*) = 2 then 'PASS' else 'FAIL' end as status
from public.session_exercise_sets ses
join public.session_exercises se on se.id = ses.session_exercise_id
where se.session_id = current_setting('test.session_id', true)::uuid;

select
  '2.5_active_client_plan_auto_created' as check_name,
  count(*)::text as observed,
  '1' as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.client_plans cp
join public.workout_sessions ws on ws.client_plan_id = cp.id
where ws.id = current_setting('test.session_id', true)::uuid
  and cp.trainer_id = 'c2000001-0000-4000-8000-000000000001'
  and cp.client_id = 'c2000001-0000-4000-8000-000000000002'
  and cp.status = 'active';

-- ---------------------------------------------------------------------------
-- 2.6 — cross-trainer create with another trainer's client_id fails
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p26$
declare
  v_exercises jsonb := $json$
[
  {
    "exercise_id": "e2000001-0000-4000-8000-000000000004",
    "phase": "main",
    "sort_order": 0,
    "notes": null,
    "sets": [
      {
        "prescribed_reps": 10,
        "prescribed_duration_seconds": null,
        "prescribed_load_kg": 40,
        "rest_after_seconds": 90
      }
    ]
  }
]
$json$::jsonb;
begin
  perform set_config(
    'test.check_p26_auth_uid',
    coalesce(auth.uid()::text, 'null'),
    true
  );

  perform public.create_workout_session(
    'c2000001-0000-4000-8000-000000000002'::uuid,
    current_date + 8,
    'Cross-trainer should fail',
    null,
    v_exercises
  );

  perform set_config('test.check_p26_observed', 'RPC succeeded', true);
  perform set_config('test.check_p26_status', 'FAIL', true);
exception
  when others then
    perform set_config('test.check_p26_observed', sqlerrm, true);
    perform set_config(
      'test.check_p26_status',
      case
        when sqlerrm ilike '%trainer is not assigned to this client%' then 'PASS'
        else 'FAIL'
      end,
      true
    );
end;
$p26$;

reset role;

select
  '2.6_trainer_b_auth_uid' as check_name,
  current_setting('test.check_p26_auth_uid', true) as observed,
  'c2000001-0000-4000-8000-000000000003' as expected,
  case
    when current_setting('test.check_p26_auth_uid', true)
      = 'c2000001-0000-4000-8000-000000000003' then 'PASS'
    else 'FAIL'
  end as status;

select
  '2.6_cross_trainer_rejected' as check_name,
  current_setting('test.check_p26_observed', true) as observed,
  'trainer is not assigned to this client' as expected,
  current_setting('test.check_p26_status', true) as status;

select
  '2.6_no_session_created_for_client_a_by_trainer_b' as check_name,
  count(*)::text as observed,
  '0' as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.workout_sessions ws
join public.client_plans cp on cp.id = ws.client_plan_id
where ws.name = 'Cross-trainer should fail'
  and cp.trainer_id = 'c2000001-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- 2.7 — update rejected after manually setting started_at
-- ---------------------------------------------------------------------------

update public.workout_sessions
set started_at = now()
where id = current_setting('test.session_id', true)::uuid;

select
  '2.7_started_at_set' as check_name,
  coalesce(started_at::text, 'null') as observed,
  'non-null timestamp' as expected,
  case when started_at is not null then 'PASS' else 'FAIL' end as status
from public.workout_sessions
where id = current_setting('test.session_id', true)::uuid;

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p27$
declare
  v_exercises jsonb := $json$
[
  {
    "exercise_id": "e2000001-0000-4000-8000-000000000002",
    "phase": "main",
    "sort_order": 0,
    "notes": "Should not apply",
    "sets": [
      {
        "prescribed_reps": 5,
        "prescribed_duration_seconds": null,
        "prescribed_load_kg": 100,
        "rest_after_seconds": 180
      }
    ]
  }
]
$json$::jsonb;
begin
  perform public.update_workout_session_snapshot(
    current_setting('test.session_id', true)::uuid,
    current_date + 9,
    'Edited after start — should fail',
    v_exercises
  );

  perform set_config('test.check_p27_observed', 'RPC succeeded', true);
  perform set_config('test.check_p27_status', 'FAIL', true);
exception
  when others then
    perform set_config('test.check_p27_observed', sqlerrm, true);
    perform set_config(
      'test.check_p27_status',
      case
        when sqlerrm ilike '%session cannot be edited after client has started%' then 'PASS'
        else 'FAIL'
      end,
      true
    );
end;
$p27$;

reset role;

select
  '2.7_update_rejected_after_started' as check_name,
  current_setting('test.check_p27_observed', true) as observed,
  'session cannot be edited after client has started' as expected,
  current_setting('test.check_p27_status', true) as status;

select
  '2.7_session_name_unchanged' as check_name,
  name as observed,
  'Phase 2 manual verify' as expected,
  case when name = 'Phase 2 manual verify' then 'PASS' else 'FAIL' end as status
from public.workout_sessions
where id = current_setting('test.session_id', true)::uuid;

select
  '2.7_exercise_snapshot_unchanged' as check_name,
  count(*)::text as observed,
  '1' as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.session_exercises
where session_id = current_setting('test.session_id', true)::uuid
  and exercise_id = 'e2000001-0000-4000-8000-000000000001';

rollback;

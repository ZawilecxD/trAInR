-- S-04 Phase 4 verification — checks 4.5, 4.6
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
--   Bench Press (trainer A) -> e2000001-0000-4000-8000-000000000001
--
-- Expected: every result row shows status = PASS.

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

-- ---------------------------------------------------------------------------
-- 4.5a — create_workout_session creates session + exercises + sets atomically
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p45a$
declare
  v_session_id uuid;
  v_exercises jsonb := $json$
[
  {
    "exercise_id": "e2000001-0000-4000-8000-000000000001",
    "phase": "main",
    "sort_order": 0,
    "notes": "Phase 4 verify",
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
    'test.check_p45a_auth_uid',
    coalesce(auth.uid()::text, 'null'),
    true
  );

  v_session_id := public.create_workout_session(
    'c2000001-0000-4000-8000-000000000002'::uuid,
    current_date + 10,
    'Phase 4 verify',
    null,
    v_exercises
  );

  perform set_config('test.session_id', v_session_id::text, true);
end;
$p45a$;

reset role;

select
  '4.5a_trainer_a_auth_uid' as check_name,
  current_setting('test.check_p45a_auth_uid', true) as observed,
  'c2000001-0000-4000-8000-000000000001' as expected,
  case
    when current_setting('test.check_p45a_auth_uid', true)
      = 'c2000001-0000-4000-8000-000000000001' then 'PASS'
    else 'FAIL'
  end as status;

select
  '4.5a_workout_session_row' as check_name,
  count(*)::text as observed,
  '1' as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.workout_sessions
where id = current_setting('test.session_id', true)::uuid
  and name = 'Phase 4 verify'
  and status = 'not_started'
  and started_at is null;

select
  '4.5a_session_exercises' as check_name,
  count(*)::text as observed,
  '1' as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.session_exercises
where session_id = current_setting('test.session_id', true)::uuid;

select
  '4.5a_session_exercise_sets' as check_name,
  count(*)::text as observed,
  '2' as expected,
  case when count(*) = 2 then 'PASS' else 'FAIL' end as status
from public.session_exercise_sets ses
join public.session_exercises se on se.id = ses.session_exercise_id
where se.session_id = current_setting('test.session_id', true)::uuid;

-- ---------------------------------------------------------------------------
-- 4.5b — cross-trainer create with another trainer's client_id fails
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p45b$
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
  perform public.create_workout_session(
    'c2000001-0000-4000-8000-000000000002'::uuid,
    current_date + 11,
    'Cross-trainer should fail',
    null,
    v_exercises
  );

  perform set_config('test.check_p45b_observed', 'RPC succeeded', true);
  perform set_config('test.check_p45b_status', 'FAIL', true);
exception
  when others then
    perform set_config('test.check_p45b_observed', sqlerrm, true);
    perform set_config(
      'test.check_p45b_status',
      case
        when sqlerrm ilike '%trainer is not assigned to this client%' then 'PASS'
        else 'FAIL'
      end,
      true
    );
end;
$p45b$;

reset role;

select
  '4.5b_cross_trainer_create_rejected' as check_name,
  current_setting('test.check_p45b_observed', true) as observed,
  'trainer is not assigned to this client' as expected,
  current_setting('test.check_p45b_status', true) as status;

-- ---------------------------------------------------------------------------
-- 4.5c — cross-trainer SELECT on session_exercise_sets returns empty
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p45c$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.session_exercise_sets ses
  join public.session_exercises se on se.id = ses.session_exercise_id
  where se.session_id = current_setting('test.session_id', true)::uuid;

  perform set_config('test.check_p45c_count', v_count::text, true);
end;
$p45c$;

reset role;

select
  '4.5c_trainer_b_cannot_read_sets' as check_name,
  current_setting('test.check_p45c_count', true) as observed,
  '0' as expected,
  case
    when current_setting('test.check_p45c_count', true) = '0' then 'PASS'
    else 'FAIL'
  end as status;

-- ---------------------------------------------------------------------------
-- 4.5d — update snapshot on not_started succeeds
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p45d$
declare
  v_exercises jsonb := $json$
[
  {
    "exercise_id": "e2000001-0000-4000-8000-000000000002",
    "phase": "main",
    "sort_order": 0,
    "notes": "Updated snapshot",
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
    current_date + 12,
    'Phase 4 updated',
    v_exercises
  );
end;
$p45d$;

reset role;

select
  '4.5d_update_not_started_succeeds' as check_name,
  name as observed,
  'Phase 4 updated' as expected,
  case when name = 'Phase 4 updated' then 'PASS' else 'FAIL' end as status
from public.workout_sessions
where id = current_setting('test.session_id', true)::uuid;

select
  '4.5d_exercise_snapshot_replaced' as check_name,
  count(*)::text as observed,
  '1' as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.session_exercises
where session_id = current_setting('test.session_id', true)::uuid
  and exercise_id = 'e2000001-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- 4.5e — update rejected after started_at set
-- ---------------------------------------------------------------------------

update public.workout_sessions
set started_at = now()
where id = current_setting('test.session_id', true)::uuid;

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p45e$
declare
  v_exercises jsonb := $json$
[
  {
    "exercise_id": "e2000001-0000-4000-8000-000000000001",
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
    current_date + 13,
    'Edited after start — should fail',
    v_exercises
  );

  perform set_config('test.check_p45e_observed', 'RPC succeeded', true);
  perform set_config('test.check_p45e_status', 'FAIL', true);
exception
  when others then
    perform set_config('test.check_p45e_observed', sqlerrm, true);
    perform set_config(
      'test.check_p45e_status',
      case
        when sqlerrm ilike '%session cannot be edited after client has started%' then 'PASS'
        else 'FAIL'
      end,
      true
    );
end;
$p45e$;

reset role;

select
  '4.5e_update_rejected_after_started' as check_name,
  current_setting('test.check_p45e_observed', true) as observed,
  'session cannot be edited after client has started' as expected,
  current_setting('test.check_p45e_status', true) as status;

-- ---------------------------------------------------------------------------
-- 4.6 — trainer removed from client cannot create new sessions
-- ---------------------------------------------------------------------------

-- Reset started_at so we can test create on a fresh session after removal
update public.workout_sessions
set started_at = null
where id = current_setting('test.session_id', true)::uuid;

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p46_remove$
declare
  v_assignment_id uuid;
begin
  select id
  into v_assignment_id
  from public.trainer_clients
  where trainer_id = 'c2000001-0000-4000-8000-000000000001'
    and client_id = 'c2000001-0000-4000-8000-000000000002'
    and status = 'active';

  perform public.remove_trainer_client(v_assignment_id);
end;
$p46_remove$;

do $p46_create$
declare
  v_exercises jsonb := $json$
[
  {
    "exercise_id": "e2000001-0000-4000-8000-000000000001",
    "phase": "main",
    "sort_order": 0,
    "notes": null,
    "sets": [
      {
        "prescribed_reps": 10,
        "prescribed_duration_seconds": null,
        "prescribed_load_kg": 50,
        "rest_after_seconds": 90
      }
    ]
  }
]
$json$::jsonb;
begin
  perform public.create_workout_session(
    'c2000001-0000-4000-8000-000000000002'::uuid,
    current_date + 14,
    'After removal — should fail',
    null,
    v_exercises
  );

  perform set_config('test.check_p46_observed', 'RPC succeeded', true);
  perform set_config('test.check_p46_status', 'FAIL', true);
exception
  when others then
    perform set_config('test.check_p46_observed', sqlerrm, true);
    perform set_config(
      'test.check_p46_status',
      case
        when sqlerrm ilike '%trainer is not assigned to this client%' then 'PASS'
        else 'FAIL'
      end,
      true
    );
end;
$p46_create$;

reset role;

select
  '4.6_removed_trainer_cannot_create' as check_name,
  current_setting('test.check_p46_observed', true) as observed,
  'trainer is not assigned to this client' as expected,
  current_setting('test.check_p46_status', true) as status;

select
  '4.6_no_session_after_removal' as check_name,
  count(*)::text as observed,
  '0' as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.workout_sessions ws
join public.client_plans cp on cp.id = ws.client_plan_id
where ws.name = 'After removal — should fail'
  and cp.trainer_id = 'c2000001-0000-4000-8000-000000000001';

rollback;

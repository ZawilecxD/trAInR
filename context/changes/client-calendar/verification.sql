-- S-05 Phase 1 verification — checks 1.5
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
-- 1. Seed client plans + workout sessions (superuser, rolled back at end)
-- ---------------------------------------------------------------------------

insert into public.client_plans (id, trainer_id, client_id, name, status, start_date)
values
  (
    'f2000001-0000-4000-8000-000000000001',
    'c2000001-0000-4000-8000-000000000001',
    'c2000001-0000-4000-8000-000000000002',
    'Client A Plan',
    'active',
    current_date
  ),
  (
    'f2000001-0000-4000-8000-000000000002',
    'c2000001-0000-4000-8000-000000000003',
    'c2000001-0000-4000-8000-000000000004',
    'Client B Plan',
    'active',
    current_date
  )
on conflict (id) do nothing;

insert into public.workout_sessions (id, client_plan_id, scheduled_date, name, status)
values
  (
    'd2000001-0000-4000-8000-000000000001',
    'f2000001-0000-4000-8000-000000000001',
    current_date,
    'Client A Session',
    'not_started'
  ),
  (
    'd2000001-0000-4000-8000-000000000002',
    'f2000001-0000-4000-8000-000000000002',
    current_date,
    'Client B Session',
    'not_started'
  )
on conflict (id) do nothing;

select
  '1_fixture_sessions_seeded' as check_name,
  count(*)::text as observed,
  '2' as expected,
  case when count(*) = 2 then 'PASS' else 'FAIL' end as status
from public.workout_sessions
where id in (
  'd2000001-0000-4000-8000-000000000001',
  'd2000001-0000-4000-8000-000000000002'
);

-- ---------------------------------------------------------------------------
-- 1.5a — Client A sees own sessions in date range
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p15a$
declare
  v_count integer;
begin
  perform set_config(
    'test.check_p15a_auth_uid',
    coalesce(auth.uid()::text, 'null'),
    true
  );

  select count(*)
  into v_count
  from public.workout_sessions ws
  join public.client_plans cp on cp.id = ws.client_plan_id
  where cp.client_id = auth.uid()
    and cp.status = 'active'
    and ws.scheduled_date between current_date - 7 and current_date + 7;

  perform set_config('test.check_p15a_own_count', v_count::text, true);
end;
$p15a$;

reset role;

select
  '1.5a_client_a_auth_uid' as check_name,
  current_setting('test.check_p15a_auth_uid', true) as observed,
  'c2000001-0000-4000-8000-000000000002' as expected,
  case
    when current_setting('test.check_p15a_auth_uid', true)
      = 'c2000001-0000-4000-8000-000000000002' then 'PASS'
    else 'FAIL'
  end as status;

select
  '1.5a_client_a_sees_own_sessions' as check_name,
  current_setting('test.check_p15a_own_count', true) as observed,
  '1' as expected,
  case
    when current_setting('test.check_p15a_own_count', true) = '1' then 'PASS'
    else 'FAIL'
  end as status;

-- ---------------------------------------------------------------------------
-- 1.5b — Client A sees zero rows for Client B's plan
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p15b$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.workout_sessions
  where client_plan_id = 'f2000001-0000-4000-8000-000000000002';

  perform set_config('test.check_p15b_other_plan_count', v_count::text, true);
end;
$p15b$;

reset role;

select
  '1.5b_client_a_cannot_read_client_b_plan' as check_name,
  current_setting('test.check_p15b_other_plan_count', true) as observed,
  '0' as expected,
  case
    when current_setting('test.check_p15b_other_plan_count', true) = '0' then 'PASS'
    else 'FAIL'
  end as status;

-- ---------------------------------------------------------------------------
-- 1.5c — Client B sees own session, not Client A's
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000004',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $p15c$
declare
  v_own_count integer;
  v_other_count integer;
begin
  select count(*)
  into v_own_count
  from public.workout_sessions ws
  join public.client_plans cp on cp.id = ws.client_plan_id
  where cp.client_id = auth.uid()
    and cp.status = 'active'
    and ws.scheduled_date between current_date - 7 and current_date + 7;

  select count(*)
  into v_other_count
  from public.workout_sessions
  where client_plan_id = 'f2000001-0000-4000-8000-000000000001';

  perform set_config('test.check_p15c_own_count', v_own_count::text, true);
  perform set_config('test.check_p15c_other_plan_count', v_other_count::text, true);
end;
$p15c$;

reset role;

select
  '1.5c_client_b_sees_own_sessions' as check_name,
  current_setting('test.check_p15c_own_count', true) as observed,
  '1' as expected,
  case
    when current_setting('test.check_p15c_own_count', true) = '1' then 'PASS'
    else 'FAIL'
  end as status;

select
  '1.5c_client_b_cannot_read_client_a_plan' as check_name,
  current_setting('test.check_p15c_other_plan_count', true) as observed,
  '0' as expected,
  case
    when current_setting('test.check_p15c_other_plan_count', true) = '0' then 'PASS'
    else 'FAIL'
  end as status;

rollback;

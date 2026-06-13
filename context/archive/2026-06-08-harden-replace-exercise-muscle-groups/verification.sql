-- Q-02 Phase 1: replace_exercise_muscle_groups ownership guard
--
-- Paste this entire script into Supabase Studio SQL Editor (local: http://127.0.0.1:54323).
-- Runs as a single transaction; all setup rows are rolled back at the end.
--
-- Prerequisites:
--   npx supabase db reset   (includes 20260609100000_harden_replace_exercise_muscle_groups.sql)
--
-- Expected: every row in the "check" result sets shows status = PASS.

-- ---------------------------------------------------------------------------
-- Clean stale fixtures from a prior failed run (safe no-op on first run)
-- ---------------------------------------------------------------------------

delete from public.exercise_muscle_groups
where exercise_id in (
  'e2000003-0000-4000-8000-000000000001',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

delete from public.exercises
where id in (
  'e2000003-0000-4000-8000-000000000001',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

delete from public.profiles
where id in (
  'e1000003-0000-4000-8000-000000000001',
  'e1000003-0000-4000-8000-000000000002',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

delete from auth.users
where id in (
  'e1000003-0000-4000-8000-000000000001',
  'e1000003-0000-4000-8000-000000000002',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

begin;

-- ---------------------------------------------------------------------------
-- Constants (deterministic UUIDs — safe to roll back)
-- ---------------------------------------------------------------------------
-- trainer A: e1000003-0000-4000-8000-000000000001
-- trainer B: e1000003-0000-4000-8000-000000000002
-- exercise:  e2000003-0000-4000-8000-000000000001 (owned by trainer A)
-- muscle:    a1000001-0000-4000-8000-000000000001 (Chest, from seed.sql)

-- ---------------------------------------------------------------------------
-- 1. Seed two trainer auth users (postgres role; trigger creates profiles)
-- ---------------------------------------------------------------------------

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'e1000003-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'q02-trainer-a@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"trainer","display_name":"Q02 Trainer A"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000003-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'q02-trainer-b@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"trainer","display_name":"Q02 Trainer B"}'::jsonb,
    now(),
    now()
  );

-- ---------------------------------------------------------------------------
-- 2. Seed trainer A exercise + junction row (postgres bypasses RLS for setup)
-- ---------------------------------------------------------------------------

reset role;

insert into public.exercises (
  id,
  trainer_id,
  name,
  exercise_type,
  default_metric,
  is_archived
)
values (
  'e2000003-0000-4000-8000-000000000001',
  'e1000003-0000-4000-8000-000000000001',
  'Q02 RPC Verify Exercise',
  'strength',
  'reps_weight',
  false
);

insert into public.exercise_muscle_groups (exercise_id, muscle_group_id, role)
values (
  'e2000003-0000-4000-8000-000000000001',
  'a1000001-0000-4000-8000-000000000001',
  'primary'
);

-- ---------------------------------------------------------------------------
-- 3. Owner can call replace_exercise_muscle_groups (clear all links)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'e1000003-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select
  'owner_auth_uid' as check_name,
  auth.uid() as observed,
  'e1000003-0000-4000-8000-000000000001'::uuid as expected,
  case
    when auth.uid() = 'e1000003-0000-4000-8000-000000000001'::uuid then 'PASS'
    else 'FAIL'
  end as status;

select public.replace_exercise_muscle_groups(
  'e2000003-0000-4000-8000-000000000001'::uuid,
  '[]'::jsonb
);

select
  'owner_rpc_clears_links' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.exercise_muscle_groups
where exercise_id = 'e2000003-0000-4000-8000-000000000001';

-- Re-seed one link for non-owner rejection test
reset role;

insert into public.exercise_muscle_groups (exercise_id, muscle_group_id, role)
values (
  'e2000003-0000-4000-8000-000000000001',
  'a1000001-0000-4000-8000-000000000001',
  'primary'
);

-- ---------------------------------------------------------------------------
-- 4. Non-owner RPC call rejected; junction row unchanged
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'e1000003-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select
  'non_owner_auth_uid' as check_name,
  auth.uid() as observed,
  'e1000003-0000-4000-8000-000000000002'::uuid as expected,
  case
    when auth.uid() = 'e1000003-0000-4000-8000-000000000002'::uuid then 'PASS'
    else 'FAIL'
  end as status;

do $verify$
begin
  perform public.replace_exercise_muscle_groups(
    'e2000003-0000-4000-8000-000000000001'::uuid,
    '[]'::jsonb
  );
  raise exception 'FAIL: non-owner RPC call should have been rejected';
exception
  when others then
    if sqlerrm not like '%Exercise not found or not authorized%' then
      raise;
    end if;
end;
$verify$;

select
  'non_owner_rpc_rejected' as check_name,
  'Exercise not found or not authorized' as observed,
  'Exercise not found or not authorized' as expected,
  'PASS' as status;

reset role;

select
  'links_unchanged_after_rejection' as check_name,
  count(*) as observed,
  1::bigint as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.exercise_muscle_groups
where exercise_id = 'e2000003-0000-4000-8000-000000000001';

rollback;

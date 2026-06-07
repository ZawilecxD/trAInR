-- S-01 Exercise Library — RLS ownership verification
--
-- Paste this entire script into Supabase Studio SQL Editor (local: http://localhost:54323).
-- Runs as a single transaction; all setup rows are rolled back at the end.
--
-- Prerequisites:
--   npx supabase db reset   (migrations + muscle_groups seed applied)
--
-- Expected: every row in the "check" result sets shows status = PASS.

begin;

-- ---------------------------------------------------------------------------
-- Constants (deterministic UUIDs — safe to roll back)
-- ---------------------------------------------------------------------------

-- trainer A: e1000001-0000-4000-8000-000000000001
-- trainer B: e1000001-0000-4000-8000-000000000002
-- exercise:  e2000001-0000-4000-8000-000000000001 (owned by trainer A)
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
    'e1000001-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-trainer-a@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"trainer","display_name":"RLS Trainer A"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000001-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-trainer-b@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"trainer","display_name":"RLS Trainer B"}'::jsonb,
    now(),
    now()
  );

-- ---------------------------------------------------------------------------
-- 2. Seed trainer A exercise fixture (postgres bypasses RLS for setup)
-- ---------------------------------------------------------------------------

reset role;

insert into public.exercises (
  id,
  trainer_id,
  name,
  exercise_type,
  default_metric,
  notes,
  is_archived
)
values (
  'e2000001-0000-4000-8000-000000000001',
  'e1000001-0000-4000-8000-000000000001',
  'RLS Test Bench Press',
  'strength',
  'reps_weight',
  'ownership verification fixture',
  false
);

-- ---------------------------------------------------------------------------
-- 3. Trainer A — can read, update own exercise, and manage junction rows
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into public.exercise_muscle_groups (exercise_id, muscle_group_id, role)
values (
  'e2000001-0000-4000-8000-000000000001',
  'a1000001-0000-4000-8000-000000000001',
  'primary'
);

select
  'trainer_a_junction_insert' as check_name,
  count(*) as observed,
  1::bigint as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.exercise_muscle_groups
where exercise_id = 'e2000001-0000-4000-8000-000000000001'
  and muscle_group_id = 'a1000001-0000-4000-8000-000000000001'
  and role = 'primary';

select
  'trainer_a_auth_uid' as check_name,
  auth.uid() as observed,
  'e1000001-0000-4000-8000-000000000001'::uuid as expected,
  case
    when auth.uid() = 'e1000001-0000-4000-8000-000000000001'::uuid then 'PASS'
    else 'FAIL'
  end as status;

select
  'trainer_a_select_own_exercise' as check_name,
  count(*) as observed,
  1::bigint as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.exercises
where id = 'e2000001-0000-4000-8000-000000000001';

update public.exercises
set notes = 'updated by trainer A'
where id = 'e2000001-0000-4000-8000-000000000001';

select
  'trainer_a_update_own_exercise' as check_name,
  notes as observed,
  'updated by trainer A' as expected,
  case when notes = 'updated by trainer A' then 'PASS' else 'FAIL' end as status
from public.exercises
where id = 'e2000001-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 4. Trainer B — cannot read or mutate trainer A data
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select
  'trainer_b_auth_uid' as check_name,
  auth.uid() as observed,
  'e1000001-0000-4000-8000-000000000002'::uuid as expected,
  case
    when auth.uid() = 'e1000001-0000-4000-8000-000000000002'::uuid then 'PASS'
    else 'FAIL'
  end as status;

select
  'trainer_b_cannot_select_a_exercise' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.exercises
where id = 'e2000001-0000-4000-8000-000000000001';

select
  'trainer_b_sees_no_exercises' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.exercises;

update public.exercises
set notes = 'blocked update by trainer B'
where id = 'e2000001-0000-4000-8000-000000000001';

reset role;

select
  'trainer_b_update_a_exercise_blocked' as check_name,
  notes as observed,
  'updated by trainer A' as expected,
  case when notes = 'updated by trainer A' then 'PASS' else 'FAIL' end as status
from public.exercises
where id = 'e2000001-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

delete from public.exercises
where id = 'e2000001-0000-4000-8000-000000000001';

reset role;

select
  'trainer_b_delete_a_exercise_blocked' as check_name,
  count(*) as observed,
  1::bigint as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.exercises
where id = 'e2000001-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- RLS blocks INSERT with an error (unlike UPDATE/DELETE); catch expected denial.
do $block$
begin
  insert into public.exercise_muscle_groups (exercise_id, muscle_group_id, role)
  values (
    'e2000001-0000-4000-8000-000000000001',
    'a1000001-0000-4000-8000-000000000002',
    'secondary'
  );
  raise exception 'FAIL: trainer B junction insert was not blocked by RLS';
exception
  when insufficient_privilege then
    null;
end;
$block$;

reset role;

select
  'trainer_b_junction_insert_blocked' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.exercise_muscle_groups
where exercise_id = 'e2000001-0000-4000-8000-000000000001'
  and muscle_group_id = 'a1000001-0000-4000-8000-000000000002'
  and role = 'secondary';

-- ---------------------------------------------------------------------------
-- 5. muscle_groups remain readable to authenticated trainers
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select
  'trainer_b_can_read_muscle_groups' as check_name,
  count(*) as observed,
  (select count(*) from public.muscle_groups)::bigint as expected,
  case
    when count(*) = (select count(*) from public.muscle_groups) then 'PASS'
    else 'FAIL'
  end as status
from public.muscle_groups;

rollback;

-- All checks should show PASS. No persistent changes were made.

-- S-14 Per-round template prescription — RLS ownership verification
--
-- Paste this entire script into Supabase Studio SQL Editor (local: http://localhost:54323).
-- Runs as a single transaction; all setup rows are rolled back at the end.
--
-- Prerequisites:
--   npx supabase db reset   (migrations + muscle_groups seed applied)
--
-- Expected: every row in the check result sets shows status = PASS.

begin;

-- ---------------------------------------------------------------------------
-- Constants (deterministic UUIDs — safe to roll back)
-- ---------------------------------------------------------------------------

-- trainer A: e1000001-0000-4000-8000-000000000001
-- trainer B: e1000001-0000-4000-8000-000000000002
-- exercise A: e2000001-0000-4000-8000-000000000001 (owned by trainer A)
-- exercise B: e2000001-0000-4000-8000-000000000002 (owned by trainer B)
-- template A: a3000001-0000-4000-8000-000000000001 (owned by trainer A)
-- template exercise A: a4000001-0000-4000-8000-000000000001
-- set A1: a5000001-0000-4000-8000-000000000001

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
-- 2. Seed exercises, template, rounds (postgres bypasses RLS for setup)
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
values
  (
    'e2000001-0000-4000-8000-000000000001',
    'e1000001-0000-4000-8000-000000000001',
    'RLS Test Bench Press',
    'strength',
    'reps_weight',
    'trainer A exercise',
    false
  ),
  (
    'e2000001-0000-4000-8000-000000000002',
    'e1000001-0000-4000-8000-000000000002',
    'RLS Test Row',
    'strength',
    'reps_weight',
    'trainer B exercise',
    false
  );

insert into public.session_templates (
  id,
  trainer_id,
  name,
  description
)
values (
  'a3000001-0000-4000-8000-000000000001',
  'e1000001-0000-4000-8000-000000000001',
  'RLS Test Template',
  'per-round ownership verification fixture'
);

insert into public.template_exercises (
  id,
  template_id,
  exercise_id,
  phase,
  sort_order,
  notes
)
values (
  'a4000001-0000-4000-8000-000000000001',
  'a3000001-0000-4000-8000-000000000001',
  'e2000001-0000-4000-8000-000000000001',
  'main',
  0,
  'fixture exercise'
);

insert into public.template_exercise_sets (
  id,
  template_exercise_id,
  set_number,
  prescribed_reps,
  prescribed_duration_seconds,
  prescribed_load_kg,
  rest_after_seconds
)
values
  (
    'a5000001-0000-4000-8000-000000000001',
    'a4000001-0000-4000-8000-000000000001',
    1,
    10,
    null,
    50.00,
    120
  ),
  (
    'a5000001-0000-4000-8000-000000000002',
    'a4000001-0000-4000-8000-000000000001',
    2,
    8,
    null,
    60.00,
    120
  );

-- ---------------------------------------------------------------------------
-- 3. Trainer A — can read, update, delete own rounds
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select
  'trainer_a_auth_uid' as check_name,
  auth.uid() as observed,
  'e1000001-0000-4000-8000-000000000001'::uuid as expected,
  case
    when auth.uid() = 'e1000001-0000-4000-8000-000000000001'::uuid then 'PASS'
    else 'FAIL'
  end as status;

select
  'trainer_a_select_own_rounds' as check_name,
  count(*) as observed,
  2::bigint as expected,
  case when count(*) = 2 then 'PASS' else 'FAIL' end as status
from public.template_exercise_sets
where template_exercise_id = 'a4000001-0000-4000-8000-000000000001';

update public.template_exercise_sets
set prescribed_reps = 12
where id = 'a5000001-0000-4000-8000-000000000001';

select
  'trainer_a_update_own_round' as check_name,
  prescribed_reps as observed,
  12 as expected,
  case when prescribed_reps = 12 then 'PASS' else 'FAIL' end as status
from public.template_exercise_sets
where id = 'a5000001-0000-4000-8000-000000000001';

insert into public.template_exercise_sets (
  template_exercise_id,
  set_number,
  prescribed_reps,
  prescribed_duration_seconds,
  prescribed_load_kg,
  rest_after_seconds
)
values (
  'a4000001-0000-4000-8000-000000000001',
  3,
  6,
  null,
  70.00,
  180
);

select
  'trainer_a_insert_own_round' as check_name,
  count(*) as observed,
  3::bigint as expected,
  case when count(*) = 3 then 'PASS' else 'FAIL' end as status
from public.template_exercise_sets
where template_exercise_id = 'a4000001-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 4. Trainer B — cannot read or mutate trainer A rounds
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
  'trainer_b_cannot_select_a_rounds' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.template_exercise_sets
where template_exercise_id = 'a4000001-0000-4000-8000-000000000001';

update public.template_exercise_sets
set prescribed_reps = 99
where id = 'a5000001-0000-4000-8000-000000000001';

reset role;

select
  'trainer_b_update_a_round_blocked' as check_name,
  prescribed_reps as observed,
  12 as expected,
  case when prescribed_reps = 12 then 'PASS' else 'FAIL' end as status
from public.template_exercise_sets
where id = 'a5000001-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

delete from public.template_exercise_sets
where id = 'a5000001-0000-4000-8000-000000000002';

reset role;

select
  'trainer_b_delete_a_round_blocked' as check_name,
  count(*) as observed,
  3::bigint as expected,
  case when count(*) = 3 then 'PASS' else 'FAIL' end as status
from public.template_exercise_sets
where template_exercise_id = 'a4000001-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $block$
begin
  insert into public.template_exercise_sets (
    template_exercise_id,
    set_number,
    prescribed_reps,
    prescribed_load_kg,
    rest_after_seconds
  )
  values (
    'a4000001-0000-4000-8000-000000000001',
    99,
    5,
    25,
    60
  );
  raise exception 'FAIL: trainer B insert into trainer A round was not blocked by RLS';
exception
  when insufficient_privilege then
    null;
end;
$block$;

reset role;

select
  'trainer_b_insert_a_round_blocked' as check_name,
  count(*) as observed,
  3::bigint as expected,
  case when count(*) = 3 then 'PASS' else 'FAIL' end as status
from public.template_exercise_sets
where template_exercise_id = 'a4000001-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 5. Trainer A can delete own round; cascade removes sets when exercise deleted
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

delete from public.template_exercise_sets
where id = 'a5000001-0000-4000-8000-000000000002';

select
  'trainer_a_delete_own_round' as check_name,
  count(*) as observed,
  2::bigint as expected,
  case when count(*) = 2 then 'PASS' else 'FAIL' end as status
from public.template_exercise_sets
where template_exercise_id = 'a4000001-0000-4000-8000-000000000001';

delete from public.template_exercises
where id = 'a4000001-0000-4000-8000-000000000001';

select
  'trainer_a_delete_exercise_cascades_rounds' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.template_exercise_sets
where template_exercise_id = 'a4000001-0000-4000-8000-000000000001';

rollback;

-- All checks should show PASS. No persistent changes were made.

-- S-02 Session Templates — RLS ownership verification
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
-- exercise A: e2000001-0000-4000-8000-000000000001 (owned by trainer A)
-- exercise B: e2000001-0000-4000-8000-000000000002 (owned by trainer B)
-- template A: t3000001-0000-4000-8000-000000000001 (owned by trainer A)

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
-- 2. Seed exercises and template fixtures (postgres bypasses RLS for setup)
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
  't3000001-0000-4000-8000-000000000001',
  'e1000001-0000-4000-8000-000000000001',
  'RLS Test Template',
  'ownership verification fixture'
);

insert into public.template_exercises (
  id,
  template_id,
  exercise_id,
  phase,
  sort_order,
  prescribed_sets,
  prescribed_reps
)
values (
  't4000001-0000-4000-8000-000000000001',
  't3000001-0000-4000-8000-000000000001',
  'e2000001-0000-4000-8000-000000000001',
  'main',
  0,
  3,
  10
);

-- ---------------------------------------------------------------------------
-- 3. Trainer A — can read, update, delete own template and exercises
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
  'trainer_a_select_own_template' as check_name,
  count(*) as observed,
  1::bigint as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.session_templates
where id = 't3000001-0000-4000-8000-000000000001';

select
  'trainer_a_select_own_template_exercises' as check_name,
  count(*) as observed,
  1::bigint as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.template_exercises
where template_id = 't3000001-0000-4000-8000-000000000001';

update public.session_templates
set description = 'updated by trainer A'
where id = 't3000001-0000-4000-8000-000000000001';

select
  'trainer_a_update_own_template' as check_name,
  description as observed,
  'updated by trainer A' as expected,
  case when description = 'updated by trainer A' then 'PASS' else 'FAIL' end as status
from public.session_templates
where id = 't3000001-0000-4000-8000-000000000001';

insert into public.session_templates (id, trainer_id, name)
values (
  't3000001-0000-4000-8000-000000000002',
  'e1000001-0000-4000-8000-000000000001',
  'Trainer A second template'
);

select
  'trainer_a_insert_own_template' as check_name,
  count(*) as observed,
  1::bigint as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.session_templates
where id = 't3000001-0000-4000-8000-000000000002';

insert into public.template_exercises (
  template_id,
  exercise_id,
  phase,
  sort_order,
  prescribed_sets,
  prescribed_reps
)
values (
  't3000001-0000-4000-8000-000000000002',
  'e2000001-0000-4000-8000-000000000001',
  'warm_up',
  0,
  2,
  8
);

select
  'trainer_a_insert_own_exercise_into_template' as check_name,
  count(*) as observed,
  1::bigint as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.template_exercises
where template_id = 't3000001-0000-4000-8000-000000000002'
  and exercise_id = 'e2000001-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 4. Trainer B — cannot read or mutate trainer A templates
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
  'trainer_b_cannot_select_a_template' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.session_templates
where id = 't3000001-0000-4000-8000-000000000001';

select
  'trainer_b_sees_no_templates' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.session_templates;

select
  'trainer_b_cannot_select_a_template_exercises' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.template_exercises
where template_id = 't3000001-0000-4000-8000-000000000001';

update public.session_templates
set description = 'blocked update by trainer B'
where id = 't3000001-0000-4000-8000-000000000001';

reset role;

select
  'trainer_b_update_a_template_blocked' as check_name,
  description as observed,
  'updated by trainer A' as expected,
  case when description = 'updated by trainer A' then 'PASS' else 'FAIL' end as status
from public.session_templates
where id = 't3000001-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

delete from public.session_templates
where id = 't3000001-0000-4000-8000-000000000001';

reset role;

select
  'trainer_b_delete_a_template_blocked' as check_name,
  count(*) as observed,
  1::bigint as expected,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status
from public.session_templates
where id = 't3000001-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 5. Trainer A cannot insert template_exercises referencing trainer B exercises
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $block$
begin
  insert into public.template_exercises (
    template_id,
    exercise_id,
    phase,
    sort_order,
    prescribed_sets,
    prescribed_reps
  )
  values (
    't3000001-0000-4000-8000-000000000001',
    'e2000001-0000-4000-8000-000000000002',
    'main',
    1,
    3,
    10
  );
  raise exception 'FAIL: trainer A insert with trainer B exercise was not blocked by RLS';
exception
  when insufficient_privilege then
    null;
end;
$block$;

reset role;

select
  'trainer_a_cannot_use_b_exercise' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.template_exercises
where template_id = 't3000001-0000-4000-8000-000000000001'
  and exercise_id = 'e2000001-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- 6. Trainer A can delete own template (cascade removes template_exercises)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'e1000001-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

delete from public.session_templates
where id = 't3000001-0000-4000-8000-000000000002';

select
  'trainer_a_delete_own_template' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.session_templates
where id = 't3000001-0000-4000-8000-000000000002';

select
  'trainer_a_delete_cascades_exercises' as check_name,
  count(*) as observed,
  0::bigint as expected,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status
from public.template_exercises
where template_id = 't3000001-0000-4000-8000-000000000002';

rollback;

-- All checks should show PASS. No persistent changes were made.

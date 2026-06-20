-- S-17 Starter Exercise Seed — signup provisioning verification
--
-- Paste this entire script into Supabase Studio SQL Editor (local: http://127.0.0.1:54323).
-- Runs as a single transaction; all setup rows are rolled back at the end.
--
-- Prerequisites:
--   npx supabase db reset   (includes 20260620140200_starter_exercise_seed.sql + muscle_groups seed)
--
-- Expected: every row in the "check" result sets shows status = PASS.

begin;

-- ---------------------------------------------------------------------------
-- Constants (deterministic UUIDs — safe to roll back)
-- ---------------------------------------------------------------------------
-- trainer A: s1000001-0000-4000-8000-000000000001
-- trainer B: s1000001-0000-4000-8000-000000000002
-- client:    s1000001-0000-4000-8000-000000000003

-- ---------------------------------------------------------------------------
-- 1. Seed trainer and client auth users (trigger creates profiles + starter seed)
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
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone_change_token,
  reauthentication_token
)
values
  (
    's1000001-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    's17-trainer-a@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"trainer","display_name":"S17 Trainer A"}'::jsonb,
    now(),
    now(),
    '', '', '', '', '', ''
  ),
  (
    's1000001-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    's17-trainer-b@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"trainer","display_name":"S17 Trainer B"}'::jsonb,
    now(),
    now(),
    '', '', '', '', '', ''
  ),
  (
    's1000001-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    's17-client@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"client","display_name":"S17 Client"}'::jsonb,
    now(),
    now(),
    '', '', '', '', '', ''
  );

-- ---------------------------------------------------------------------------
-- 2. Trainer signup provisioning checks
-- ---------------------------------------------------------------------------

select
  'trainer A profile seeded marker' as check_name,
  case
    when starter_exercises_seeded_at is not null then 'PASS'
    else 'FAIL'
  end as status
from public.profiles
where id = 's1000001-0000-4000-8000-000000000001';

select
  'trainer A starter exercise count' as check_name,
  case
    when count(*) = 20 then 'PASS'
    else 'FAIL'
  end as status
from public.exercises
where trainer_id = 's1000001-0000-4000-8000-000000000001';

select
  'trainer A muscle-group link count' as check_name,
  case
    when count(*) = 20 then 'PASS'
    else 'FAIL'
  end as status
from public.exercise_muscle_groups emg
join public.exercises e on e.id = emg.exercise_id
where e.trainer_id = 's1000001-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 3. Client signup exclusion checks
-- ---------------------------------------------------------------------------

select
  'client profile has no seed marker' as check_name,
  case
    when starter_exercises_seeded_at is null then 'PASS'
    else 'FAIL'
  end as status
from public.profiles
where id = 's1000001-0000-4000-8000-000000000003';

select
  'client has zero exercises' as check_name,
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as status
from public.exercises
where trainer_id = 's1000001-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- 4. Idempotency check
-- ---------------------------------------------------------------------------

select public.seed_starter_exercises_for_trainer('s1000001-0000-4000-8000-000000000001');

select
  'reseed does not duplicate trainer A exercises' as check_name,
  case
    when count(*) = 20 then 'PASS'
    else 'FAIL'
  end as status
from public.exercises
where trainer_id = 's1000001-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 5. RLS isolation checks (trainer B cannot see trainer A seeded rows)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 's1000001-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select
  'auth.uid() sanity for trainer B' as check_name,
  case
    when auth.uid() = 's1000001-0000-4000-8000-000000000002'::uuid then 'PASS'
    else 'FAIL'
  end as status;

select
  'trainer B cannot select trainer A exercises' as check_name,
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as status
from public.exercises
where trainer_id = 's1000001-0000-4000-8000-000000000001';

select
  'trainer B sees only own seeded exercises' as check_name,
  case
    when count(*) = 20 then 'PASS'
    else 'FAIL'
  end as status
from public.exercises
where trainer_id = 's1000001-0000-4000-8000-000000000002';

rollback;

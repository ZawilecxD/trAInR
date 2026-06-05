-- S-11 Phase 1 manual verification (local Supabase)
-- Copy-paste into Supabase Studio SQL Editor.
-- Expect: PASS notice on double-remove; ends with rollback (no persistent test data).

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'c1000001-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'trainer-remove@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"trainer","display_name":"Remove Test Trainer"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c1000001-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'client-remove@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"client","display_name":"Remove Test Client"}'::jsonb,
    now(), now()
  );

do $setup$
declare
  v_assignment_id uuid;
  v_plan_id uuid;
  v_session_id uuid;
begin
  insert into public.trainer_clients (trainer_id, client_id, status)
  values (
    'c1000001-0000-4000-8000-000000000001',
    'c1000001-0000-4000-8000-000000000002',
    'active'::public.trainer_client_status
  )
  returning id into v_assignment_id;

  insert into public.client_plans (trainer_id, client_id, name, status, start_date)
  values (
    'c1000001-0000-4000-8000-000000000001',
    'c1000001-0000-4000-8000-000000000002',
    'Verify removal plan',
    'active'::public.client_plan_status,
    current_date
  )
  returning id into v_plan_id;

  insert into public.workout_sessions (client_plan_id, scheduled_date, name)
  values (v_plan_id, current_date, 'Verify session')
  returning id into v_session_id;

  perform set_config('test.assignment_id', v_assignment_id::text, true);
  perform set_config('test.plan_id', v_plan_id::text, true);
  perform set_config('test.session_id', v_session_id::text, true);
end;
$setup$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'c1000001-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select auth.uid() as trainer_uid;
-- Expect: c1000001-0000-4000-8000-000000000001

select count(*) as trainer_sees_active_assignment
from public.trainer_clients
where trainer_id = auth.uid()
  and status = 'active'::public.trainer_client_status;
-- Expect: 1

select count(*) as trainer_sees_active_plan_before
from public.client_plans
where trainer_id = auth.uid()
  and client_id = 'c1000001-0000-4000-8000-000000000002';
-- Expect: 1

select count(*) as trainer_sees_session_before
from public.workout_sessions ws
join public.client_plans cp on cp.id = ws.client_plan_id
where cp.trainer_id = auth.uid();
-- Expect: 1

select public.remove_trainer_client(
  current_setting('test.assignment_id')::uuid
);

reset role;

select status, removed_at is not null as has_removed_at
from public.trainer_clients
where id = current_setting('test.assignment_id')::uuid;
-- Expect: status = removed, has_removed_at = true

select status
from public.client_plans
where id = current_setting('test.plan_id')::uuid;
-- Expect: archived

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'c1000001-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select count(*) as trainer_active_assignment_after
from public.trainer_clients
where trainer_id = auth.uid()
  and status = 'active'::public.trainer_client_status;
-- Expect: 0

select count(*) as trainer_sees_plan_after_removal
from public.client_plans
where id = current_setting('test.plan_id')::uuid;
-- Expect: 0

select count(*) as trainer_sees_session_after_removal
from public.workout_sessions
where id = current_setting('test.session_id')::uuid;
-- Expect: 0

do $do$
begin
  perform public.remove_trainer_client(
    current_setting('test.assignment_id')::uuid
  );
  raise exception 'FAIL: second remove should have raised';
exception
  when others then
    raise notice 'PASS: second remove rejected: %', sqlerrm;
end;
$do$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'c1000001-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select auth.uid() as client_uid;

select count(*) as client_sees_archived_plan
from public.client_plans
where id = current_setting('test.plan_id')::uuid;
-- Expect: 1

rollback;

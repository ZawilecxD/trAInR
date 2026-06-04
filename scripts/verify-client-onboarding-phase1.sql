-- Phase 1 manual verification (local Supabase)
-- Run: npm run verify:client-onboarding-p1
-- Or:  docker exec -i supabase_db_10x-astro-starter psql -U postgres -d postgres -f - < scripts/verify-client-onboarding-phase1.sql
-- Local Studio SQL Editor cannot INSERT into auth.users (permission denied).

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'b1000001-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'trainer-verify@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"trainer","display_name":"Test Trainer"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b1000001-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'client-verify@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"client","display_name":"Test Client"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b1000001-0000-4000-8000-000000000099',
    'authenticated', 'authenticated',
    'stranger-verify@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"client","display_name":"Stranger"}'::jsonb,
    now(), now()
  );

select id, role, display_name
from public.profiles
where id in (
  'b1000001-0000-4000-8000-000000000001',
  'b1000001-0000-4000-8000-000000000002'
)
order by role;

insert into public.invite_links (trainer_id, token, expires_at)
values (
  'b1000001-0000-4000-8000-000000000001',
  'test-token-plan-verification',
  now() + interval '7 days'
);

select public.validate_invite_token('test-token-plan-verification');
select public.validate_invite_token('does-not-exist');

update public.invite_links
set expires_at = now() - interval '1 day'
where token = 'test-token-plan-verification';

select public.validate_invite_token('test-token-plan-verification');

update public.invite_links
set
  expires_at = now() + interval '7 days',
  used_at = null,
  used_by_client_id = null
where token = 'test-token-plan-verification';

select public.complete_client_invite(
  'test-token-plan-verification',
  'b1000001-0000-4000-8000-000000000002'::uuid
);

select used_at, used_by_client_id
from public.invite_links
where token = 'test-token-plan-verification';

select trainer_id, client_id, status
from public.trainer_clients
where trainer_id = 'b1000001-0000-4000-8000-000000000001';

do $do$
begin
  perform public.complete_client_invite(
    'test-token-plan-verification',
    'b1000001-0000-4000-8000-000000000002'::uuid
  );
  raise exception 'FAIL: second consume should have raised';
exception
  when others then
    raise notice 'PASS: second consume rejected: %', sqlerrm;
end;
$do$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b1000001-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select auth.uid() as trainer_uid;

select id, display_name
from public.profiles
where id = 'b1000001-0000-4000-8000-000000000002';

select id, display_name
from public.profiles
where id = 'b1000001-0000-4000-8000-000000000099';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b1000001-0000-4000-8000-000000000002',
  true
);

select auth.uid() as client_uid;

select id, display_name
from public.profiles
where id = 'b1000001-0000-4000-8000-000000000001';

rollback;

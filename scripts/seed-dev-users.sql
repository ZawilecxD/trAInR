-- Local dev seed: trainers, clients, assignments, and sample exercises.
-- Password for all accounts: Rooster2
--
-- Runs automatically after supabase/seed.sql on `supabase db reset` (see supabase/config.toml).
-- Re-run without a full reset (idempotent): npm run seed:dev-users
--
-- Studio SQL Editor cannot INSERT into auth.users — use npm run seed:dev-users instead.

-- Fixed IDs
-- trainer-A@gmail.com  -> c2000001-0000-4000-8000-000000000001
-- client-A@gmail.com   -> c2000001-0000-4000-8000-000000000002
-- trainer-B@gmail.com  -> c2000001-0000-4000-8000-000000000003
-- client-B@gmail.com   -> c2000001-0000-4000-8000-000000000004

do $seed$
declare
  u record;
  v_password text := 'Rooster2';
  v_encrypted_pw text := crypt(v_password, gen_salt('bf', 10));
begin
  delete from auth.users
  where email in (
    'trainer-A@gmail.com',
    'client-A@gmail.com',
    'trainer-B@gmail.com',
    'client-B@gmail.com'
  );

  for u in
    select *
    from (
      values
        (
          'c2000001-0000-4000-8000-000000000001'::uuid,
          'trainer-A@gmail.com',
          'trainer',
          'Trainer A'
        ),
        (
          'c2000001-0000-4000-8000-000000000002'::uuid,
          'client-A@gmail.com',
          'client',
          'Client A'
        ),
        (
          'c2000001-0000-4000-8000-000000000003'::uuid,
          'trainer-B@gmail.com',
          'trainer',
          'Trainer B'
        ),
        (
          'c2000001-0000-4000-8000-000000000004'::uuid,
          'client-B@gmail.com',
          'client',
          'Client B'
        )
    ) as seed_users (id, email, role, display_name)
  loop
    insert into auth.users (
      instance_id,
      id,
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
    values (
      '00000000-0000-0000-0000-000000000000',
      u.id,
      'authenticated',
      'authenticated',
      u.email,
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      json_build_object('role', u.role, 'display_name', u.display_name)::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      u.id,
      json_build_object(
        'sub', u.id::text,
        'email', u.email,
        'email_verified', true,
        'phone_verified', false
      )::jsonb,
      'email',
      u.id::text,
      now(),
      now(),
      now()
    );
  end loop;
end;
$seed$;

-- Trainer ↔ client assignments (profiles created by handle_new_user trigger)
insert into public.trainer_clients (trainer_id, client_id, status)
values
  (
    'c2000001-0000-4000-8000-000000000001',
    'c2000001-0000-4000-8000-000000000002',
    'active'
  ),
  (
    'c2000001-0000-4000-8000-000000000003',
    'c2000001-0000-4000-8000-000000000004',
    'active'
  );

-- Sample exercises per trainer (muscle_groups from supabase/seed.sql)
insert into public.exercises (id, trainer_id, name, exercise_type, default_metric, notes)
values
  (
    'e2000001-0000-4000-8000-000000000001',
    'c2000001-0000-4000-8000-000000000001',
    'Bench Press',
    'strength',
    'reps_weight',
    'Barbell flat bench press'
  ),
  (
    'e2000001-0000-4000-8000-000000000002',
    'c2000001-0000-4000-8000-000000000001',
    'Back Squat',
    'strength',
    'reps_weight',
    'High-bar back squat'
  ),
  (
    'e2000001-0000-4000-8000-000000000003',
    'c2000001-0000-4000-8000-000000000001',
    'Plank',
    'other',
    'time',
    'Forearm plank hold'
  ),
  (
    'e2000001-0000-4000-8000-000000000004',
    'c2000001-0000-4000-8000-000000000003',
    'Barbell Row',
    'strength',
    'reps_weight',
    'Bent-over barbell row'
  ),
  (
    'e2000001-0000-4000-8000-000000000005',
    'c2000001-0000-4000-8000-000000000003',
    'Romanian Deadlift',
    'strength',
    'reps_weight',
    'Hip-hinge posterior chain'
  ),
  (
    'e2000001-0000-4000-8000-000000000006',
    'c2000001-0000-4000-8000-000000000003',
    'Lat Pulldown',
    'strength',
    'reps_weight',
    'Cable lat pulldown'
  );

insert into public.exercise_muscle_groups (exercise_id, muscle_group_id, role)
values
  ('e2000001-0000-4000-8000-000000000001', 'a1000001-0000-4000-8000-000000000001', 'primary'),
  ('e2000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000007', 'primary'),
  ('e2000001-0000-4000-8000-000000000003', 'a1000001-0000-4000-8000-00000000000b', 'primary'),
  ('e2000001-0000-4000-8000-000000000004', 'a1000001-0000-4000-8000-000000000002', 'primary'),
  ('e2000001-0000-4000-8000-000000000005', 'a1000001-0000-4000-8000-000000000008', 'primary'),
  ('e2000001-0000-4000-8000-000000000006', 'a1000001-0000-4000-8000-000000000002', 'primary');

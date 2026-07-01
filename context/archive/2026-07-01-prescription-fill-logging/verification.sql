-- S-19 prescription-fill-logging — manual verification in Supabase Studio
-- Copy-paste the entire script into the SQL Editor and run once.
-- Expect: sanity checks pass; fill-style upsert succeeds for client A; rollback at end.

begin;

-- ---------------------------------------------------------------------------
-- 0. Resolve dev seed user IDs (adjust if your seed differs)
-- ---------------------------------------------------------------------------
select id, email
from auth.users
where email in ('client-A@example.com', 'trainer-A@example.com')
order by email;
-- Expect: 2 rows

-- ---------------------------------------------------------------------------
-- 1. Session context for client A (from seed)
-- ---------------------------------------------------------------------------
select
  ws.id as session_id,
  se.id as session_exercise_id,
  e.name as exercise_name,
  e.default_metric,
  ses.set_number,
  ses.prescribed_reps,
  ses.prescribed_load_kg,
  ses.prescribed_duration_seconds
from public.workout_sessions ws
join public.client_plans cp on cp.id = ws.client_plan_id
join public.session_exercises se on se.session_id = ws.id
join public.exercises e on e.id = se.exercise_id
left join public.session_exercise_sets ses on ses.session_exercise_id = se.id
where cp.client_id = (select id from auth.users where email = 'client-A@example.com')
order by ws.scheduled_date desc, se.sort_order, ses.set_number
limit 10;
-- Expect: at least one session_exercise_id with prescribed sets

-- ---------------------------------------------------------------------------
-- 2. Act as client A — upsert filled values with is_complete = false (S-19)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'client-A@example.com'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select auth.uid() as client_uid;
-- Expect: non-null UUID matching client-A

-- Pick first session exercise with a prescribed set (edit UUID if seed layout differs)
with target as (
  select se.id as session_exercise_id
  from public.session_exercises se
  join public.workout_sessions ws on ws.id = se.session_id
  join public.client_plans cp on cp.id = ws.client_plan_id
  where cp.client_id = auth.uid()
  limit 1
)
insert into public.set_logs (
  session_exercise_id,
  set_number,
  reps,
  duration_seconds,
  load_kg,
  is_complete,
  is_warmup
)
select
  t.session_exercise_id,
  1,
  10,
  null,
  50,
  false,
  false
from target t
on conflict (session_exercise_id, set_number)
do update set
  reps = excluded.reps,
  load_kg = excluded.load_kg,
  is_complete = false,
  is_warmup = excluded.is_warmup
returning id, session_exercise_id, set_number, reps, load_kg, is_complete;
-- Expect: 1 row; is_complete = false; reps/load populated

-- ---------------------------------------------------------------------------
-- 3. Client can read back the filled log
-- ---------------------------------------------------------------------------
select sl.set_number, sl.reps, sl.load_kg, sl.is_complete
from public.set_logs sl
join public.session_exercises se on se.id = sl.session_exercise_id
join public.workout_sessions ws on ws.id = se.session_id
join public.client_plans cp on cp.id = ws.client_plan_id
where cp.client_id = auth.uid()
  and sl.set_number = 1
order by sl.logged_at desc
limit 5;
-- Expect: row with reps/load set and is_complete = false

rollback;
-- All changes above are rolled back — safe for production-like DBs

-- S-20 manual verification: finished session exercise summary data
-- Run in Supabase Studio SQL Editor (local or linked project).
-- Uses transaction + rollback so no permanent changes.

begin;

-- ---------------------------------------------------------------------------
-- 1. Pick a finished client session (adjust email if needed)
-- ---------------------------------------------------------------------------
select
  ws.id as session_id,
  ws.name,
  ws.status,
  ws.completed_at,
  ws.locked_at,
  p.email as client_email
from workout_sessions ws
join client_plans cp on cp.id = ws.client_plan_id
join auth.users u on u.id = cp.client_id
join profiles p on p.id = u.id
where ws.status in ('finished', 'finished_partially', 'cancelled')
order by ws.completed_at desc nulls last
limit 5;

-- Copy a session_id from above into the variable below:
-- \set session_id 'YOUR-SESSION-UUID-HERE'

-- Example using dev seed client-A (if present):
-- session_id from client-A's most recent finished session:
with target as (
  select ws.id
  from workout_sessions ws
  join client_plans cp on cp.id = ws.client_plan_id
  join auth.users u on u.id = cp.client_id
  where u.email = 'client-A@gmail.com'
    and ws.status in ('finished', 'finished_partially', 'cancelled')
  order by ws.completed_at desc nulls last
  limit 1
)
select
  ws.id,
  ws.status,
  ws.locked_at,
  case
    when ws.locked_at is null then 'no edit window'
    when ws.locked_at > now() then 'edit window open'
    else 'sealed'
  end as edit_window_state
from workout_sessions ws
where ws.id = (select id from target);

-- ---------------------------------------------------------------------------
-- 2. Exercise + prescription + logs (what the summary should show)
-- ---------------------------------------------------------------------------
with target as (
  select ws.id
  from workout_sessions ws
  join client_plans cp on cp.id = ws.client_plan_id
  join auth.users u on u.id = cp.client_id
  where u.email = 'client-A@gmail.com'
    and ws.status in ('finished', 'finished_partially', 'cancelled')
  order by ws.completed_at desc nulls last
  limit 1
)
select
  se.id as session_exercise_id,
  e.name as exercise_name,
  se.phase,
  ses.set_number,
  ses.prescribed_reps,
  ses.prescribed_load_kg,
  ses.prescribed_duration_seconds,
  sl.reps as logged_reps,
  sl.load_kg as logged_load_kg,
  sl.duration_seconds as logged_duration_seconds
from session_exercises se
join exercises e on e.id = se.exercise_id
left join session_exercise_sets ses on ses.session_exercise_id = se.id
left join set_logs sl
  on sl.session_exercise_id = se.id
 and sl.set_number = ses.set_number
where se.session_id = (select id from target)
order by se.sort_order, ses.set_number;

-- PASS: At least one row per prescribed set; logged columns populated where client logged values.
-- FAIL: No session_exercises rows for a finished session that should have exercises.

-- ---------------------------------------------------------------------------
-- 3. Optional — simulate sealed session (read-only, no Edit in UI)
-- ---------------------------------------------------------------------------
-- Uncomment to test sealed state locally, then open /client/sessions/<id> in browser.
--
-- update workout_sessions
-- set locked_at = now() - interval '1 hour'
-- where id = (select id from target);

rollback;

-- Manual UI checks after picking a session_id:
-- 1. Open /client/sessions/<session_id> as the owning client.
-- 2. Confirm phase-grouped exercise cards with Prescribed / Actual columns.
-- 3. If edit_window_state = 'edit window open', Edit button appears; tap Edit → editable tables.
-- 4. If sealed or cancelled, no Edit button; summary remains visible.

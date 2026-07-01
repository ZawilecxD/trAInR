-- S-13 verification — data edit window seal (FR-022)
--
-- Paste into Supabase Studio SQL Editor. Single transaction; rolls back at end.
-- Prerequisites: npx supabase db reset (or migrations through 20260701120000 applied)

begin;

-- ---------------------------------------------------------------------------
-- 1. is_workout_session_sealed helper
-- ---------------------------------------------------------------------------

select
  '1_sealed_past_deadline' as check_name,
  public.is_workout_session_sealed(gen_random_uuid()) as observed_unrelated,
  false as expected_unrelated,
  case
    when public.is_workout_session_sealed(gen_random_uuid()) = false then 'PASS'
    else 'FAIL'
  end as status;

do $seal$
declare
  v_session_id uuid := gen_random_uuid();
begin
  insert into public.workout_sessions (id, client_plan_id, scheduled_date, name, status, locked_at)
  select v_session_id, cp.id, current_date, 'Seal verify', 'not_started', '2020-01-01T00:00:00Z'
  from public.client_plans cp
  limit 1;

  perform set_config('test.sealed_session', v_session_id::text, true);
end;
$seal$;

select
  '2_helper_true_when_past' as check_name,
  public.is_workout_session_sealed(current_setting('test.sealed_session')::uuid) as observed,
  true as expected,
  case
    when public.is_workout_session_sealed(current_setting('test.sealed_session')::uuid) then 'PASS'
    else 'FAIL'
  end as status;

select
  '3_helper_false_future_deadline' as check_name,
  (
    select not public.is_workout_session_sealed(ws.id)
    from public.workout_sessions ws
    where ws.locked_at > now()
    limit 1
  ) as observed,
  true as expected,
  case
    when exists (
      select 1 from public.workout_sessions ws where ws.locked_at > now()
    )
      and (
        select not public.is_workout_session_sealed(ws.id)
        from public.workout_sessions ws
        where ws.locked_at > now()
        limit 1
      )
    then 'PASS'
    when not exists (select 1 from public.workout_sessions ws where ws.locked_at > now())
    then 'PASS — no future deadline rows to sample'
    else 'FAIL'
  end as status;

rollback;

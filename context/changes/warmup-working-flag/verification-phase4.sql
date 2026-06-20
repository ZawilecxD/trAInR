-- S-10 Phase 4 optional manual verification — client can upsert is_warmup on own set_logs
-- Paste into Supabase Studio SQL Editor after migrations + dev seed.
-- Expected: every result row shows status = PASS.

begin;

do $setup$
declare
  v_own_se uuid;
  v_set_number integer;
begin
  select se.id
  into v_own_se
  from public.session_exercises se
  join public.workout_sessions ws on ws.id = se.session_id
  join public.client_plans cp on cp.id = ws.client_plan_id
  where cp.client_id = 'c2000001-0000-4000-8000-000000000002'
  order by ws.scheduled_date desc, se.sort_order
  limit 1;

  if v_own_se is null then
    raise exception 'No session exercise for client-A — run npx supabase db reset';
  end if;

  perform set_config('test.own_se', v_own_se::text, true);

  select coalesce(max(sl.set_number), 0) + 1
  into v_set_number
  from public.set_logs sl
  where sl.session_exercise_id = v_own_se;

  perform set_config('test.set_number', v_set_number::text, true);
end;
$setup$;

select set_config(
  'request.jwt.claim.sub',
  'c2000001-0000-4000-8000-000000000002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $insert$
declare
  v_log_id uuid;
begin
  insert into public.set_logs (
    session_exercise_id,
    set_number,
    reps,
    load_kg,
    is_complete,
    is_warmup
  )
  values (
    current_setting('test.own_se')::uuid,
    current_setting('test.set_number')::integer,
    10,
    50,
    false,
    true
  )
  returning id into v_log_id;

  perform set_config('test.log_id', v_log_id::text, true);
end;
$insert$;

do $update$
declare
  v_updated_count integer;
begin
  update public.set_logs
  set is_warmup = false
  where id = current_setting('test.log_id')::uuid;

  get diagnostics v_updated_count = row_count;
  perform set_config('test.updated_count', v_updated_count::text, true);
end;
$update$;

reset role;

select
  'client_a_upserts_is_warmup' as check_name,
  current_setting('test.updated_count', true) as observed,
  '1' as expected,
  case
    when current_setting('test.updated_count', true) = '1' then 'PASS'
    else 'FAIL'
  end as status;

rollback;

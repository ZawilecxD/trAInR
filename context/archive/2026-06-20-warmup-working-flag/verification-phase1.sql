-- S-10 Phase 1 manual verification: prescription is_warmup columns
-- Copy-paste into Supabase Studio SQL Editor (after migrations applied).
-- Expect: both columns exist, default false, readable by authenticated role.

begin;

select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('template_exercise_sets', 'session_exercise_sets')
  and column_name = 'is_warmup'
order by table_name;
-- Expect: 2 rows, boolean, default false, NO

select auth.uid() as current_uid;
-- Expect: NULL in Studio (service role) — column check above is the gate for Phase 1.

rollback;

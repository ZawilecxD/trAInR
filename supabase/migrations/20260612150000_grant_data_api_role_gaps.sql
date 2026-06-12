-- Fill Data API grant gaps exposed after Supabase CLI stopped auto-exposing tables
-- (auto_expose_new_tables default false, 2026-05-30). service_role was restored in
-- 20260612140000; this migration covers anon and authenticated cases that relied on
-- the old default privileges.

-- anon SELECT: no row-visible policies for anon on these tables; RLS returns [] not 42501.
grant select on table public.exercises to anon;
grant select on table public.invite_links to anon;

-- set_logs: intentional omission of DELETE in 20260526120400; authenticated needs the
-- table privilege so DELETE hits RLS (no policy → 0 rows) instead of permission denied.
grant delete on table public.set_logs to authenticated;

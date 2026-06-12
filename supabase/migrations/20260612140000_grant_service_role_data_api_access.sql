-- service_role is the trusted server-side/test key (bypasses RLS by design).
-- The Supabase CLI/cloud no longer auto-grants Data API roles on new tables
-- (auto_expose_new_tables flipped to false, 2026-05-30), so grant explicitly.

-- Existing tables
grant select, insert, update, delete on all tables in schema public to service_role;

-- Future tables: keep service_role reachable without per-table grants,
-- while leaving anon/authenticated on the project's explicit-grant convention.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

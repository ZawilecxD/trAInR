-- S-08: Add 'cancelled' to session_status enum
-- ALTER TYPE ... ADD VALUE is non-transactional in PostgreSQL and cannot be
-- executed inside an explicit transaction block. Supabase migrations run each
-- file in autocommit mode, so this is safe as a standalone statement.

alter type public.session_status add value if not exists 'cancelled';

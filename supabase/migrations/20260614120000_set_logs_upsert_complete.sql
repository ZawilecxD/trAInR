-- S-06 Phase 1: set_logs upsert safety + OK-toggle completion flag

alter table public.set_logs
  add column is_complete boolean not null default false;

comment on column public.set_logs.is_complete is
  'Client OK toggle — true when the set is marked complete during guided logging.';

alter table public.set_logs
  add constraint set_logs_session_exercise_set_number_unique
  unique (session_exercise_id, set_number);

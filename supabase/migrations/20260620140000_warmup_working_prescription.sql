-- S-10 Phase 1: warm-up vs working flag on prescribed rounds

alter table public.template_exercise_sets
  add column is_warmup boolean not null default false;

alter table public.session_exercise_sets
  add column is_warmup boolean not null default false;

comment on column public.template_exercise_sets.is_warmup is
  'Trainer marks round as warm-up; defaults client set_logs.is_warmup when logging.';

comment on column public.session_exercise_sets.is_warmup is
  'Snapshot of template round warm-up flag at session creation/edit time.';

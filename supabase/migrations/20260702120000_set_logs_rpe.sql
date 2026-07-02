-- S-21: optional per-set RPE (Rate of Perceived Exertion, Borg CR-10 1–10)

alter table public.set_logs
  add column rpe smallint;

alter table public.set_logs
  add constraint set_logs_rpe_range check (rpe is null or (rpe >= 1 and rpe <= 10));

comment on column public.set_logs.rpe is
  'Optional client-logged RPE (1–10 Borg CR-10). Null when not recorded.';

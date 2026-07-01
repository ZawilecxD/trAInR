-- S-13: seal deadline starts at session completion (done/partial), not first set log.

comment on column public.workout_sessions.locked_at is
  'UTC seal deadline: completed_at + 24h for finished/partial sessions. Writes denied when now() >= locked_at.';

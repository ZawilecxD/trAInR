-- S-15: per-trainer exercise favourites (FR-009 extension)

alter table public.exercises
  add column is_favourite boolean not null default false;

comment on column public.exercises.is_favourite is
  'Trainer-marked favourite for faster browse/filter in library and pickers.';

create index exercises_trainer_favourite_idx
  on public.exercises (trainer_id, is_favourite)
  where is_favourite = true;

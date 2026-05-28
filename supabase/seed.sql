-- F-01: canonical muscle_groups for FR-009 filtering (idempotent by name)

insert into public.muscle_groups (id, name, region)
values
  ('a1000001-0000-4000-8000-000000000001', 'Chest', 'upper_body'),
  ('a1000001-0000-4000-8000-000000000002', 'Back', 'upper_body'),
  ('a1000001-0000-4000-8000-000000000003', 'Shoulders', 'upper_body'),
  ('a1000001-0000-4000-8000-000000000004', 'Biceps', 'upper_body'),
  ('a1000001-0000-4000-8000-000000000005', 'Triceps', 'upper_body'),
  ('a1000001-0000-4000-8000-000000000006', 'Forearms', 'upper_body'),
  ('a1000001-0000-4000-8000-000000000007', 'Quadriceps', 'lower_body'),
  ('a1000001-0000-4000-8000-000000000008', 'Hamstrings', 'lower_body'),
  ('a1000001-0000-4000-8000-000000000009', 'Glutes', 'lower_body'),
  ('a1000001-0000-4000-8000-00000000000a', 'Calves', 'lower_body'),
  ('a1000001-0000-4000-8000-00000000000b', 'Abdominals', 'core'),
  ('a1000001-0000-4000-8000-00000000000c', 'Obliques', 'core'),
  ('a1000001-0000-4000-8000-00000000000d', 'Full body', 'full_body')
on conflict (name) do nothing;

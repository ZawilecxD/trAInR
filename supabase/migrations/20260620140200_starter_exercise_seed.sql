-- S-17: starter exercise catalog copied per trainer on signup

-- ---------------------------------------------------------------------------
-- profiles: idempotency marker for starter seed provisioning
-- ---------------------------------------------------------------------------

alter table public.profiles
add column starter_exercises_seeded_at timestamptz;

comment on column public.profiles.starter_exercises_seeded_at is
  'Set when starter exercises were provisioned for this trainer on signup. Null for clients and pre-S-17 trainers.';

-- ---------------------------------------------------------------------------
-- seed_starter_exercises_for_trainer — SECURITY DEFINER catalog clone
-- ---------------------------------------------------------------------------

create or replace function public.seed_starter_exercises_for_trainer(p_trainer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  catalog record;
  v_exercise_id uuid;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_trainer_id
      and p.role = 'trainer'::public.user_role
      and p.starter_exercises_seeded_at is null
  ) then
    return;
  end if;

  for catalog in
    select *
    from (
      values
        ('Bench Press', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Barbell flat bench press', 'Chest'),
        ('Incline Dumbbell Press', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Incline dumbbell chest press', 'Chest'),
        ('Cable Fly', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Standing cable chest fly', 'Chest'),
        ('Barbell Back Squat', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'High-bar back squat', 'Quadriceps'),
        ('Romanian Deadlift', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Hip-hinge posterior chain', 'Hamstrings'),
        ('Leg Press', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Machine leg press', 'Quadriceps'),
        ('Walking Lunge', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Alternating forward lunge', 'Quadriceps'),
        ('Hip Thrust', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Barbell glute bridge on bench', 'Glutes'),
        ('Standing Calf Raise', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Machine or bodyweight calf raise', 'Calves'),
        ('Barbell Row', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Bent-over barbell row', 'Back'),
        ('Lat Pulldown', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Cable lat pulldown', 'Back'),
        ('Pull-Up', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Overhand pull-up or assisted variation', 'Back'),
        ('Overhead Press', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Standing barbell or dumbbell press', 'Shoulders'),
        ('Lateral Raise', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Dumbbell lateral raise', 'Shoulders'),
        ('Barbell Curl', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Standing barbell biceps curl', 'Biceps'),
        ('Tricep Pushdown', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Cable rope or bar pushdown', 'Triceps'),
        ('Plank', 'other'::public.exercise_type, 'time'::public.exercise_metric, 'Forearm plank hold', 'Abdominals'),
        ('Russian Twist', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Seated torso rotation with weight', 'Obliques'),
        ('Treadmill Run', 'cardio'::public.exercise_type, 'time'::public.exercise_metric, 'Steady-state or interval run', 'Full body'),
        ('Burpee', 'strength'::public.exercise_type, 'reps_weight'::public.exercise_metric, 'Full-body conditioning movement', 'Full body')
    ) as starter_catalog (name, exercise_type, default_metric, notes, primary_muscle)
  loop
    insert into public.exercises (trainer_id, name, exercise_type, default_metric, notes)
    values (
      p_trainer_id,
      catalog.name,
      catalog.exercise_type,
      catalog.default_metric,
      catalog.notes
    )
    returning id into v_exercise_id;

    insert into public.exercise_muscle_groups (exercise_id, muscle_group_id, role)
    select
      v_exercise_id,
      mg.id,
      'primary'::public.muscle_role
    from public.muscle_groups mg
    where mg.name = catalog.primary_muscle;

    if not found then
      raise exception 'Starter seed muscle group not found: %', catalog.primary_muscle;
    end if;
  end loop;

  update public.profiles
  set starter_exercises_seeded_at = now()
  where id = p_trainer_id;
end;
$$;

comment on function public.seed_starter_exercises_for_trainer(uuid) is
  'Copy the curated starter exercise catalog into one trainer library. Idempotent via profiles.starter_exercises_seeded_at.';

revoke all on function public.seed_starter_exercises_for_trainer(uuid) from public;
revoke all on function public.seed_starter_exercises_for_trainer(uuid) from authenticated, anon;
grant execute on function public.seed_starter_exercises_for_trainer(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- handle_new_user — provision starter exercises for new trainers
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
  resolved_role public.user_role;
begin
  meta_role := new.raw_user_meta_data ->> 'role';

  if meta_role in ('trainer', 'client') then
    resolved_role := meta_role::public.user_role;
  else
    resolved_role := 'trainer'::public.user_role;
  end if;

  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    resolved_role,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'User'
    )
  );

  if resolved_role = 'trainer'::public.user_role then
    perform public.seed_starter_exercises_for_trainer(new.id);
  end if;

  return new;
end;
$$;

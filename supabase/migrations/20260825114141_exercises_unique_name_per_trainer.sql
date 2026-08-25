-- Unique exercise name per trainer (case-insensitive trim), including archived.
-- Backfill suffixes existing duplicates so the index can apply.

create or replace function public.dedupe_exercise_names_for_unique_index()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  candidate text;
  n int;
begin
  for r in
    select e.id, e.trainer_id, e.name
    from public.exercises e
    where exists (
      select 1
      from public.exercises o
      where o.trainer_id = e.trainer_id
        and lower(btrim(o.name)) = lower(btrim(e.name))
        and o.id <> e.id
    )
    and e.id <> (
      select k.id
      from public.exercises k
      where k.trainer_id = e.trainer_id
        and lower(btrim(k.name)) = lower(btrim(e.name))
      order by k.created_at asc, k.id asc
      limit 1
    )
    order by e.trainer_id, lower(btrim(e.name)), e.created_at, e.id
  loop
    n := 2;
    loop
      candidate := btrim(r.name) || ' (' || n || ')';
      exit when not exists (
        select 1
        from public.exercises x
        where x.trainer_id = r.trainer_id
          and lower(btrim(x.name)) = lower(btrim(candidate))
          and x.id <> r.id
      );
      n := n + 1;
    end loop;

    update public.exercises
    set name = candidate
    where id = r.id;
  end loop;
end;
$$;

comment on function public.dedupe_exercise_names_for_unique_index() is
  'Suffix duplicate exercise names per trainer (CI trim) so exercises_trainer_id_name_ci_uidx can apply. Keeps earliest created_at (tie-break id).';

revoke all on function public.dedupe_exercise_names_for_unique_index() from public;
revoke all on function public.dedupe_exercise_names_for_unique_index() from authenticated, anon;
grant execute on function public.dedupe_exercise_names_for_unique_index() to service_role;

-- Service-role helpers for integration tests that need a pre-index (duplicate) state.
create or replace function public.drop_exercises_trainer_id_name_ci_uidx()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  drop index if exists public.exercises_trainer_id_name_ci_uidx;
end;
$$;

create or replace function public.create_exercises_trainer_id_name_ci_uidx()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  create unique index if not exists exercises_trainer_id_name_ci_uidx
    on public.exercises (trainer_id, lower(btrim(name)));
end;
$$;

revoke all on function public.drop_exercises_trainer_id_name_ci_uidx() from public;
revoke all on function public.drop_exercises_trainer_id_name_ci_uidx() from authenticated, anon;
grant execute on function public.drop_exercises_trainer_id_name_ci_uidx() to service_role;

revoke all on function public.create_exercises_trainer_id_name_ci_uidx() from public;
revoke all on function public.create_exercises_trainer_id_name_ci_uidx() from authenticated, anon;
grant execute on function public.create_exercises_trainer_id_name_ci_uidx() to service_role;

select public.dedupe_exercise_names_for_unique_index();
select public.create_exercises_trainer_id_name_ci_uidx();

comment on index public.exercises_trainer_id_name_ci_uidx is
  'Unique exercise name per trainer, case-insensitive trim; includes archived.';

-- S-03 Phase 1: invite token RPCs + profile cross-visibility for trainer/client

-- ---------------------------------------------------------------------------
-- validate_invite_token — anon-safe lookup for signup page trust copy
-- ---------------------------------------------------------------------------

create or replace function public.validate_invite_token(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'valid', true,
    'trainer_id', il.trainer_id,
    'trainer_display_name', p.display_name
  )
  into result
  from public.invite_links il
  join public.profiles p on p.id = il.trainer_id
  where il.token = p_token
    and il.used_at is null
    and (il.expires_at is null or il.expires_at > now())
  limit 1;

  if result is null then
    return json_build_object(
      'valid', false,
      'trainer_id', null,
      'trainer_display_name', null
    );
  end if;

  return result;
end;
$$;

revoke all on function public.validate_invite_token(text) from public;
grant execute on function public.validate_invite_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- complete_client_invite — atomically consume token + assign trainer_clients
-- ---------------------------------------------------------------------------

create or replace function public.complete_client_invite(
  p_token text,
  p_client_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trainer_id uuid;
  v_rows int;
begin
  update public.invite_links
  set
    used_at = now(),
    used_by_client_id = p_client_id
  where token = p_token
    and used_at is null
    and (expires_at is null or expires_at > now())
  returning trainer_id into v_trainer_id;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception 'invite token invalid, expired, or already used';
  end if;

  insert into public.trainer_clients (trainer_id, client_id)
  values (v_trainer_id, p_client_id);
end;
$$;

revoke all on function public.complete_client_invite(text, uuid) from public;
grant execute on function public.complete_client_invite(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles RLS — cross-visibility for assigned trainer ↔ client
-- ---------------------------------------------------------------------------

create policy "profiles_trainer_select_active_clients"
on public.profiles
for select
to authenticated
using (
  id in (
    select tc.client_id
    from public.trainer_clients tc
    where tc.trainer_id = auth.uid()
      and tc.status = 'active'::public.trainer_client_status
  )
);

create policy "profiles_client_select_assigned_trainer"
on public.profiles
for select
to authenticated
using (
  id in (
    select tc.trainer_id
    from public.trainer_clients tc
    where tc.client_id = auth.uid()
      and tc.status = 'active'::public.trainer_client_status
  )
);

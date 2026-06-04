-- S-03: client dashboard — assigned trainer lookup (SECURITY DEFINER; bypasses profiles RLS)

create or replace function public.get_my_assigned_trainer()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if auth.uid() is null then
    return null;
  end if;

  select json_build_object(
    'trainer_id', tc.trainer_id,
    'display_name', p.display_name
  )
  into result
  from public.trainer_clients tc
  join public.profiles p on p.id = tc.trainer_id
  where tc.client_id = auth.uid()
    and tc.status = 'active'::public.trainer_client_status
  order by tc.assigned_at desc
  limit 1;

  return result;
end;
$$;

revoke all on function public.get_my_assigned_trainer() from public;
grant execute on function public.get_my_assigned_trainer() to authenticated;

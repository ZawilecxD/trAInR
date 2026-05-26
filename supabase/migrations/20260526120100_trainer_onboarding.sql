-- F-01 Phase 2a: trainer_clients, invite_links, cross-assignment RLS helpers

-- ---------------------------------------------------------------------------
-- trainer_clients — trainer ↔ client assignment (soft removal via status)
-- ---------------------------------------------------------------------------

create table public.trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  status public.trainer_client_status not null default 'active',
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint trainer_clients_trainer_client_distinct check (trainer_id <> client_id)
);

create index trainer_clients_trainer_id_idx on public.trainer_clients (trainer_id);
create index trainer_clients_client_id_idx on public.trainer_clients (client_id);

comment on table public.trainer_clients is 'Trainer–client assignment; removed rows retained for history.';

-- ---------------------------------------------------------------------------
-- invite_links — one-time tokens (trainer CRUD only; no anon policies in F-01)
-- ---------------------------------------------------------------------------

create table public.invite_links (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  used_at timestamptz,
  used_by_client_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invite_links_trainer_id_idx on public.invite_links (trainer_id);

comment on table public.invite_links is 'Single-use invite tokens; validation RPC deferred to S-03.';

-- ---------------------------------------------------------------------------
-- RLS helpers (reference trainer_clients; used by later table policies)
-- ---------------------------------------------------------------------------

create or replace function public.is_trainer_for_client(p_client_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.trainer_clients
    where trainer_id = auth.uid()
      and client_id = p_client_id
      and status = 'active'::public.trainer_client_status
  );
$$;

create or replace function public.is_assigned_trainer(p_trainer_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.trainer_clients
    where client_id = auth.uid()
      and trainer_id = p_trainer_id
      and status = 'active'::public.trainer_client_status
  );
$$;

grant execute on function public.is_trainer_for_client(uuid) to authenticated;
grant execute on function public.is_assigned_trainer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- trainer_clients RLS
-- ---------------------------------------------------------------------------

alter table public.trainer_clients enable row level security;

grant select, insert, update on table public.trainer_clients to authenticated;

create policy "trainer_clients_trainer_select_active"
on public.trainer_clients
for select
to authenticated
using (
  trainer_id = auth.uid()
  and status = 'active'::public.trainer_client_status
);

create policy "trainer_clients_trainer_insert"
on public.trainer_clients
for insert
to authenticated
with check (trainer_id = auth.uid());

create policy "trainer_clients_trainer_update"
on public.trainer_clients
for update
to authenticated
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());

create policy "trainer_clients_client_select"
on public.trainer_clients
for select
to authenticated
using (client_id = auth.uid());

-- ---------------------------------------------------------------------------
-- invite_links RLS (trainer-owned only; anon has no policies)
-- ---------------------------------------------------------------------------

alter table public.invite_links enable row level security;

grant select, insert, update, delete on table public.invite_links to authenticated;

create policy "invite_links_trainer_select"
on public.invite_links
for select
to authenticated
using (trainer_id = auth.uid());

create policy "invite_links_trainer_insert"
on public.invite_links
for insert
to authenticated
with check (trainer_id = auth.uid());

create policy "invite_links_trainer_update"
on public.invite_links
for update
to authenticated
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());

create policy "invite_links_trainer_delete"
on public.invite_links
for delete
to authenticated
using (trainer_id = auth.uid());

-- Incremental update: case priority + multi-user case assignment ("Tasks")
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- This only contains what was added since the last schema.sql apply — it is
-- also already included in supabase/schema.sql for future fresh setups.

do $$
begin
  create type public.case_priority as enum ('low', 'medium', 'high', 'urgent');
exception
  when duplicate_object then null;
end $$;

alter table public.cases add column if not exists priority public.case_priority not null default 'medium';

alter table public.notifications add column if not exists priority public.case_priority;

create table if not exists public.case_assignees (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assigned_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (case_id, user_id)
);

create index if not exists case_assignees_case_id_idx on public.case_assignees (case_id);
create index if not exists case_assignees_user_id_idx on public.case_assignees (user_id);

alter table public.case_assignees enable row level security;

drop policy if exists "Users can read case assignees they can access" on public.case_assignees;
create policy "Users can read case assignees they can access"
on public.case_assignees for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
  or exists (
    select 1 from public.client_access ca
    join public.cases cs on cs.client_id = ca.client_id
    where cs.id = case_assignees.case_id and ca.user_id = auth.uid()
  )
);

drop policy if exists "Admins can manage case assignees" on public.case_assignees;
create policy "Admins can manage case assignees"
on public.case_assignees
for all
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

create or replace function public.notify_case_assignment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor_name text;
  v_case_title text;
  v_client_id uuid;
  v_client_name text;
  v_priority public.case_priority;
begin
  if new.user_id is distinct from new.assigned_by then
    select full_name into v_actor_name from public.users where id = new.assigned_by;
    select title, client_id, priority into v_case_title, v_client_id, v_priority
      from public.cases where id = new.case_id;
    select name into v_client_name from public.clients where id = v_client_id;

    insert into public.notifications (
      user_id, actor_id, actor_name, type, case_id, case_title, client_id, client_name, priority
    )
    values (
      new.user_id, new.assigned_by, coalesce(v_actor_name, 'Someone'), 'case_assigned',
      new.case_id, v_case_title, v_client_id, v_client_name, v_priority
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_case_assignment on public.case_assignees;
create trigger trg_notify_case_assignment
after insert on public.case_assignees
for each row execute function public.notify_case_assignment();

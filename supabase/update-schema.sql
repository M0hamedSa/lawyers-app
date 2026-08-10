-- Incremental update: user status (active / closed)
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- This only contains what was added since the last schema.sql apply — it is
-- also already included in supabase/schema.sql for future fresh setups.
--
-- Closing a user blocks their login (enforced in the login server action and
-- in middleware for already-open sessions) and excludes them from the case
-- assignee picker and future auto-granted client access. It does not delete
-- or hide any of their historical data anywhere else in the app.

alter table public.users add column if not exists status text not null default 'active';

do $$
begin
  alter table public.users add constraint users_status_check check (status in ('active', 'closed'));
exception
  when duplicate_object then null;
end $$;

create or replace function public.grant_all_users_client_access()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.client_access (user_id, client_id)
  select id, new.id from public.users where status = 'active'
  on conflict do nothing;
  return new;
end;
$$;

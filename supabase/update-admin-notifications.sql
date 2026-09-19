-- Incremental update: notify admins when cash advance is added/deleted or when a case/task is assigned.
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- Already folded into supabase/schema.sql for future fresh setups.

alter table public.notifications add column if not exists target_name text;

create or replace function public.notify_case_assignment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor_name text;
  v_target_name text;
  v_case_title text;
  v_client_id uuid;
  v_client_name text;
  v_priority public.case_priority;
  recipient record;
begin
  select full_name into v_actor_name from public.users where id = new.assigned_by;
  select full_name into v_target_name from public.users where id = new.user_id;
  select title, client_id, priority into v_case_title, v_client_id, v_priority
    from public.cases where id = new.case_id;
  select name into v_client_name from public.clients where id = v_client_id;

  -- 1. Notify the assigned user (if not self-assigned)
  if new.user_id is distinct from new.assigned_by then
    insert into public.notifications (
      user_id, actor_id, actor_name, type, case_id, case_title, client_id, client_name, priority
    )
    values (
      new.user_id, new.assigned_by, coalesce(v_actor_name, 'Someone'), 'case_assigned',
      new.case_id, v_case_title, v_client_id, v_client_name, v_priority
    );
  end if;

  -- 2. Notify admins and superadmins (excluding the assigner and the assigned user)
  for recipient in
    select id from public.users
    where role in ('admin', 'superadmin')
      and (new.assigned_by is null or id is distinct from new.assigned_by)
      and id is distinct from new.user_id
  loop
    insert into public.notifications (
      user_id, actor_id, actor_name, target_name, type, case_id, case_title, client_id, client_name, priority
    )
    values (
      recipient.id, new.assigned_by, coalesce(v_actor_name, 'Someone'), coalesce(v_target_name, 'User'), 'case_assigned',
      new.case_id, v_case_title, v_client_id, v_client_name, v_priority
    );
  end loop;

  return new;
end;
$$;

create or replace function public.notify_user_of_cash_advance()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor_name text;
  v_target_name text;
  recipient record;
begin
  select full_name into v_actor_name from public.users where id = new.created_by;
  select full_name into v_target_name from public.users where id = new.user_id;

  -- 1. Notify the user receiving the cash advance (if not self-created)
  if new.user_id is distinct from new.created_by then
    insert into public.notifications (
      user_id,
      actor_id,
      actor_name,
      type,
      amount
    )
    values (
      new.user_id,
      new.created_by,
      coalesce(v_actor_name, 'Superadmin'),
      'cash_advance_added',
      new.amount
    );
  end if;

  -- 2. Notify admins and superadmins (excluding the creator and the recipient)
  for recipient in
    select id from public.users
    where role in ('admin', 'superadmin')
      and (new.created_by is null or id is distinct from new.created_by)
      and id is distinct from new.user_id
  loop
    insert into public.notifications (
      user_id,
      actor_id,
      actor_name,
      target_name,
      type,
      amount
    )
    values (
      recipient.id,
      new.created_by,
      coalesce(v_actor_name, 'Superadmin'),
      coalesce(v_target_name, 'User'),
      'cash_advance_added',
      new.amount
    );
  end loop;

  return new;
end;
$$;

create or replace function public.notify_user_of_cash_advance_deletion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor_name text;
  v_target_name text;
  v_actor_id uuid;
  recipient record;
begin
  v_actor_id := auth.uid();
  if v_actor_id is not null then
    select full_name into v_actor_name from public.users where id = v_actor_id;
  end if;
  select full_name into v_target_name from public.users where id = old.user_id;

  -- 1. Notify the affected user
  if old.user_id is distinct from v_actor_id then
    insert into public.notifications (
      user_id,
      actor_id,
      actor_name,
      type,
      amount
    )
    values (
      old.user_id,
      v_actor_id,
      coalesce(v_actor_name, 'Superadmin'),
      'cash_advance_deleted',
      old.amount
    );
  end if;

  -- 2. Notify admins and superadmins (excluding the actor and the affected user)
  for recipient in
    select id from public.users
    where role in ('admin', 'superadmin')
      and (v_actor_id is null or id is distinct from v_actor_id)
      and id is distinct from old.user_id
  loop
    insert into public.notifications (
      user_id,
      actor_id,
      actor_name,
      target_name,
      type,
      amount
    )
    values (
      recipient.id,
      v_actor_id,
      coalesce(v_actor_name, 'Superadmin'),
      coalesce(v_target_name, 'User'),
      'cash_advance_deleted',
      old.amount
    );
  end loop;

  return old;
end;
$$;

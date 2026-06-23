-- Law Ledger MVP schema for Supabase
-- Run this in the Supabase SQL editor after creating a project.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.user_role as enum ('superadmin', 'admin', 'user');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.profit_type as enum ('monthly', 'per_case');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.transaction_type as enum ('payment', 'expense', 'profit', 'office');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.transaction_type add value if not exists 'office';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.voucher_type as enum ('cash', 'bank_transfer', 'check', 'card', 'other');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  profit_type public.profit_type not null default 'monthly',
  profit numeric(12, 2) default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open',
  profit_amount numeric(12, 2) default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_access (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(client_id, user_id)
);

create table if not exists public.case_files (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  filename text not null,
  file_size bigint not null,
  mime_type text,
  mega_node_id text not null,
  mega_parent_id text,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_files_case_id_idx on public.case_files (case_id);

drop trigger if exists case_files_set_updated_at on public.case_files;
create trigger case_files_set_updated_at
before update on public.case_files
for each row execute function public.set_updated_at();

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null,
  voucher_type public.voucher_type not null default 'cash',
  date date not null default current_date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_name_idx on public.clients using gin (to_tsvector('simple', name));
create index if not exists cases_client_id_idx on public.cases (client_id);
create index if not exists cases_title_idx on public.cases using gin (to_tsvector('simple', title));
create index if not exists transactions_client_id_date_idx on public.transactions (client_id, date desc);
create index if not exists transactions_date_idx on public.transactions (date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at
before update on public.cases
for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create or replace view public.client_financial_summary as
select
  c.id as client_id,
  coalesce(sum(t.amount) filter (where t.type = 'payment'), 0)::numeric(12, 2) as total_payments,
  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric(12, 2) as total_expenses,
  coalesce(sum(t.amount) filter (where t.type = 'profit'), 0)::numeric(12, 2) as total_profit,
  (
    coalesce(sum(t.amount) filter (where t.type = 'payment'), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)
  )::numeric(12, 2) as balance
from public.clients c
left join public.transactions t on t.client_id = c.id
group by c.id;

create or replace view public.case_financial_summary as
select
  cs.id as case_id,
  cs.client_id,
  coalesce(sum(t.amount) filter (where t.type = 'payment'), 0)::numeric(12, 2) as total_payments,
  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric(12, 2) as total_expenses,
  (
    coalesce(sum(t.amount) filter (where t.type = 'payment'), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)
  )::numeric(12, 2) as balance
from public.cases cs
left join public.transactions t on t.case_id = cs.id
group by cs.id, cs.client_id;

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.client_access enable row level security;
alter table public.cases enable row level security;
alter table public.case_files enable row level security;
alter table public.transactions enable row level security;

-- Case Files policies

drop policy if exists "Users can read case files of assigned clients" on public.case_files;
create policy "Users can read case files of assigned clients"
on public.case_files for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
  or exists (
    select 1 from public.client_access ca
    join public.cases cs on cs.client_id = ca.client_id
    where cs.id = case_files.case_id and ca.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert case files" on public.case_files;
create policy "Users can insert case files"
on public.case_files for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'superadmin')
    )
    or exists (
      select 1 from public.client_access ca
      join public.cases cs on cs.client_id = ca.client_id
      where cs.id = case_id and ca.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can delete own case files" on public.case_files;
create policy "Users can delete own case files"
on public.case_files for delete
to authenticated
using (
  uploaded_by = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

-- Users policies
drop policy if exists "Authenticated users can read firm users" on public.users;
create policy "Authenticated users can read firm users"
on public.users for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
on public.users for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users for update
to authenticated
using (
  id = auth.uid() 
  or 
  exists (
    select 1 from public.users u 
    where u.id = auth.uid() and u.role = 'superadmin'
  )
)
with check (
  id = auth.uid() 
  or 
  exists (
    select 1 from public.users u 
    where u.id = auth.uid() and u.role = 'superadmin'
  )
);

-- Client Access policies
drop policy if exists "Admins can manage client access" on public.client_access;
create policy "Admins can manage client access"
on public.client_access
for all
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

drop policy if exists "Users can read client access" on public.client_access;
create policy "Users can read client access"
on public.client_access for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

-- Cases policies

drop policy if exists "Superadmins can delete cases" on public.cases;
create policy "Superadmins can delete cases"
on public.cases for delete
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'superadmin'
  )
);

drop policy if exists "Users can delete own cases" on public.cases;
create policy "Users can delete own cases"
on public.cases for delete
to authenticated
using (
  created_by = auth.uid()
);

-- Clients policies
drop policy if exists "Users can read assigned clients" on public.clients;
create policy "Users can read assigned clients"
on public.clients for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
  or
  exists (
    select 1 from public.client_access ca
    where ca.client_id = public.clients.id and ca.user_id = auth.uid()
  )
);

drop policy if exists "Admin only can create clients" on public.clients;
create policy "Admin only can create clients"
on public.clients for insert
to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

drop policy if exists "Authenticated users can update clients" on public.clients;
create policy "Admins can update clients"
on public.clients for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

drop policy if exists "Admins can delete clients" on public.clients;
create policy "Admins can delete clients"
on public.clients for delete
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

-- Transactions policies
drop policy if exists "Users can read transactions of assigned clients" on public.transactions;
create policy "Users can read transactions of assigned clients"
on public.transactions for select
to authenticated
using (
  (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'superadmin')
    )
    or
    exists (
      select 1 from public.client_access ca
      where ca.client_id = public.transactions.client_id and ca.user_id = auth.uid()
    )
  )
  and (
    type != 'profit'
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'superadmin'
    )
  )
);

drop policy if exists "Authenticated users can create transactions" on public.transactions;
create policy "Authenticated users can create transactions"
on public.transactions for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    type = 'office'
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'superadmin')
    )
    or exists (
      select 1 from public.client_access ca
      where ca.client_id = client_id and ca.user_id = auth.uid()
    )
  )
);

drop policy if exists "Authenticated users can update transactions" on public.transactions;
create policy "Authenticated users can update transactions"
on public.transactions for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
  or created_by = auth.uid()
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
  or (
    type = 'office'
    and created_by = auth.uid()
  )
  or (
    created_by = auth.uid()
    and exists (
      select 1 from public.client_access ca
      where ca.client_id = client_id and ca.user_id = auth.uid()
    )
  )
);

drop policy if exists "Admins can delete transactions" on public.transactions;
create policy "Admins can delete transactions"
on public.transactions for delete
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

do $$
begin
  alter publication supabase_realtime add table public.clients;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Automatically create a profile for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, full_name, role)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    'user'::public.user_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------
-- Auto-grant all users access when a new client is created
-- -----------------------------------------------------------------------
-- When a client is inserted, a row is added to client_access for every
-- existing user. This runs at the database level so it cannot be bypassed
-- regardless of how the client was created (UI, API, migration, etc.).

create or replace function public.grant_all_users_client_access()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.client_access (user_id, client_id)
  select id, new.id from public.users
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_grant_all_users_client_access on public.clients;
create trigger trg_grant_all_users_client_access
  after insert on public.clients
  for each row execute function public.grant_all_users_client_access();

-- Regular users ('user' role) can add cases, transactions and case files,
-- but can no longer edit or delete them. Admin and superadmin access is
-- unchanged.

-- Transactions: remove creator-based update/delete access
drop policy if exists "Creators or admins can update transactions" on public.transactions;
drop policy if exists "Creators or admins can delete transactions" on public.transactions;

drop policy if exists "Authenticated users can update transactions" on public.transactions;
drop policy if exists "Admins can update transactions" on public.transactions;
create policy "Admins can update transactions"
on public.transactions for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'superadmin'
  )
  or (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
    and type <> 'system'
    and not exists (
      select 1 from public.users creator
      where creator.id = transactions.created_by and creator.role = 'superadmin'
    )
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'superadmin'
  )
  or (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
    and type <> 'system'
    and not exists (
      select 1 from public.users creator
      where creator.id = transactions.created_by and creator.role = 'superadmin'
    )
  )
);

-- Cases: only admins can update; creators no longer delete their own
drop policy if exists "Users can delete own cases" on public.cases;

drop policy if exists "Authenticated users can update cases" on public.cases;
drop policy if exists "Admins can update cases" on public.cases;
create policy "Admins can update cases"
on public.cases for update
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

-- Case files: only admins can delete
drop policy if exists "Users can delete case files of assigned clients" on public.case_files;
drop policy if exists "Admins can delete case files" on public.case_files;
create policy "Admins can delete case files"
on public.case_files for delete
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

-- Users: self-updates go through "Users can update their own basic info",
-- which keeps role and cash_advance unchanged. This broader policy let a user
-- set their own role, since permissive policies are OR'd together.
drop policy if exists "Users can update own profile" on public.users;

-- Incremental update: admin can edit/delete any transaction, except ones
-- created by a superadmin or of type 'system' (monthly retainer entries).
-- Superadmin keeps unrestricted access. Regular users are unaffected.
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- Already folded into supabase/schema.sql for future fresh setups.

drop policy if exists "Authenticated users can update transactions" on public.transactions;
create policy "Authenticated users can update transactions"
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
    and type != 'system'
    and not exists (
      select 1 from public.users creator
      where creator.id = transactions.created_by and creator.role = 'superadmin'
    )
  )
  or created_by = auth.uid()
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
    and type != 'system'
    and not exists (
      select 1 from public.users creator
      where creator.id = transactions.created_by and creator.role = 'superadmin'
    )
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
    where u.id = auth.uid() and u.role = 'superadmin'
  )
  or (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
    and type != 'system'
    and not exists (
      select 1 from public.users creator
      where creator.id = transactions.created_by and creator.role = 'superadmin'
    )
  )
);

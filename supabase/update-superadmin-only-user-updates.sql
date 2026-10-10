-- Only superadmins can update other users' rows (role, status,
-- cash_advance). Admins previously could, which let an admin promote
-- themselves to superadmin. Self-updates still go through
-- "Users can update their own basic info".
drop policy if exists "Admins can update all user info" on public.users;
drop policy if exists "Superadmins can update all user info" on public.users;
create policy "Superadmins can update all user info"
on public.users for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'superadmin'
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'superadmin'
  )
);

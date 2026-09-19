-- Incremental update: only admin and superadmin can create cases.
-- Normal users can no longer create new cases.
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- Already folded into supabase/schema.sql for future fresh setups.

drop policy if exists "Authenticated users can create cases" on public.cases;
drop policy if exists "Admins can create cases" on public.cases;

create policy "Admins can create cases"
on public.cases for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'superadmin')
  )
);

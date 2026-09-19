-- Incremental update: rename voucher_type enum value 'other' to 'online_pay'
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- Already folded into supabase/schema.sql for future fresh setups.

do $$
begin
  alter type public.voucher_type rename value 'other' to 'online_pay';
exception
  when undefined_object then null;
  when invalid_parameter_value then null;
end $$;

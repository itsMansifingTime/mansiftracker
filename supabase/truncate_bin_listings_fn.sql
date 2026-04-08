-- Fast clear for full AH snapshot (POST /api/bin-listings/full-sync).
-- DELETE on huge tables often hits "statement timeout"; TRUNCATE does not.
-- Run once in Supabase SQL editor.

create or replace function public.truncate_bin_listings()
returns void
language sql
security definer
set search_path = public
as $$
  truncate table public.bin_listings;
$$;

grant execute on function public.truncate_bin_listings() to service_role;

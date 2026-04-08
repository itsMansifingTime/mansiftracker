-- Run once after schema.sql: Hypixel stores armor/cosmetic dyes under ExtraAttributes.dye_item
-- (e.g. DYE_AQUAMARINE), not dye / Dye — so older dye_present definitions never matched.
-- Recreates generated column dye_present on ended_auctions and bin_listings.

create or replace function public.dye_present_from_extra_attributes(e jsonb)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(e ? 'dye', false)
    or coalesce(e ? 'Dye', false)
    or coalesce(e ? 'dye_item', false);
$$;

drop index if exists public.ended_auctions_dye_present_idx;
alter table public.ended_auctions drop column if exists dye_present;

alter table public.ended_auctions
  add column dye_present boolean
  generated always as (
    public.dye_present_from_extra_attributes(public.extra_attributes_jsonb(item_json))
  ) stored;

create index if not exists ended_auctions_dye_present_idx
  on public.ended_auctions (dye_present)
  where dye_present = true;

drop index if exists public.bin_listings_dye_present_idx;
alter table public.bin_listings drop column if exists dye_present;

alter table public.bin_listings
  add column dye_present boolean
  generated always as (
    public.dye_present_from_extra_attributes(public.extra_attributes_jsonb(item_json))
  ) stored;

create index if not exists bin_listings_dye_present_idx
  on public.bin_listings (dye_present)
  where dye_present = true;

-- Browse filters (same helpers as ended_auctions). Run in Supabase SQL editor once.
-- Requires public.extra_attributes_jsonb, public.dye_present_from_extra_attributes,
-- and public.item_rarity_from_item_json (from schema.sql).

alter table public.bin_listings
  add column if not exists is_bin boolean not null default true;

alter table public.bin_listings
  add column if not exists extra_attributes jsonb
  generated always as (public.extra_attributes_jsonb(item_json)) stored;

alter table public.bin_listings
  add column if not exists item_rarity text
  generated always as (public.item_rarity_from_item_json(item_json)) stored;

alter table public.bin_listings
  add column if not exists item_upgrade_level int
  generated always as (
    case
      when item_json #> '{i,0,tag,ExtraAttributes,upgrade_level}' is not null
      then (item_json #>> '{i,0,tag,ExtraAttributes,upgrade_level}')::numeric::int
      when item_json #> '{tag,ExtraAttributes,upgrade_level}' is not null
      then (item_json #>> '{tag,ExtraAttributes,upgrade_level}')::numeric::int
      else null
    end
  ) stored;

alter table public.bin_listings
  add column if not exists dye_present boolean
  generated always as (
    public.dye_present_from_extra_attributes(public.extra_attributes_jsonb(item_json))
  ) stored;

alter table public.bin_listings
  add column if not exists skin_present boolean
  generated always as (
    coalesce(public.extra_attributes_jsonb(item_json) ? 'skin', false)
  ) stored;

alter table public.bin_listings
  add column if not exists rune_present boolean
  generated always as (
    (coalesce(public.extra_attributes_jsonb(item_json)->'runes', '{}'::jsonb) <> '{}'::jsonb)
  ) stored;

create index if not exists bin_listings_item_rarity_idx
  on public.bin_listings (item_rarity);

create index if not exists bin_listings_upgrade_level_idx
  on public.bin_listings (item_upgrade_level);

create index if not exists bin_listings_dye_present_idx
  on public.bin_listings (dye_present)
  where dye_present = true;

create index if not exists bin_listings_skin_present_idx
  on public.bin_listings (skin_present)
  where skin_present = true;

create index if not exists bin_listings_rune_present_idx
  on public.bin_listings (rune_present)
  where rune_present = true;

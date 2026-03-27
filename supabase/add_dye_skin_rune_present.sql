-- Run once in Supabase SQL editor if your DB already has ended_auctions but not these columns.
-- Generated columns cannot reference another generated column (extra_attributes), so we use
-- the same ExtraAttributes slice via a function of item_json only.

create or replace function public.extra_attributes_jsonb(j jsonb)
returns jsonb
language sql
immutable
parallel safe
as $$
  select coalesce(
    j #> '{i,0,tag,ExtraAttributes}',
    j #> '{tag,ExtraAttributes}'
  );
$$;

alter table public.ended_auctions
  add column if not exists dye_present boolean
  generated always as (
    coalesce(public.extra_attributes_jsonb(item_json) ? 'dye', false)
    or coalesce(public.extra_attributes_jsonb(item_json) ? 'Dye', false)
  ) stored;

alter table public.ended_auctions
  add column if not exists skin_present boolean
  generated always as (
    coalesce(public.extra_attributes_jsonb(item_json) ? 'skin', false)
  ) stored;

alter table public.ended_auctions
  add column if not exists rune_present boolean
  generated always as (
    (coalesce(public.extra_attributes_jsonb(item_json)->'runes', '{}'::jsonb) <> '{}'::jsonb)
  ) stored;

create index if not exists ended_auctions_dye_present_idx
  on public.ended_auctions (dye_present)
  where dye_present = true;

create index if not exists ended_auctions_skin_present_idx
  on public.ended_auctions (skin_present)
  where skin_present = true;

create index if not exists ended_auctions_rune_present_idx
  on public.ended_auctions (rune_present)
  where rune_present = true;

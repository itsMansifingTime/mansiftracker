-- Run in Supabase SQL editor (once)

create table if not exists public.sold_hyperions (
  id uuid primary key default gen_random_uuid(),
  auction_id text not null unique,
  seller_uuid text not null,
  seller_name text not null,
  sold_price bigint not null,
  craft_cost_snapshot bigint not null,
  over_craft bigint not null,
  "timestamp" timestamptz not null
);

create index if not exists sold_hyperions_timestamp_idx
  on public.sold_hyperions ("timestamp" desc);

create index if not exists sold_hyperions_seller_uuid_idx
  on public.sold_hyperions (seller_uuid);

-- Mansif purchases (buyer = Mansif)
create table if not exists public.purchased_hyperions (
  id uuid primary key default gen_random_uuid(),
  auction_id text not null unique,
  buyer_uuid text not null,
  buyer_name text not null,
  bought_price bigint not null,
  craft_cost_snapshot bigint not null,
  over_craft bigint not null,
  seller_name text,
  "timestamp" timestamptz not null
);

create index if not exists purchased_hyperions_timestamp_idx
  on public.purchased_hyperions ("timestamp" desc);

create index if not exists purchased_hyperions_buyer_uuid_idx
  on public.purchased_hyperions (buyer_uuid);

-- Every auction seen in Hypixel auctions_ended (rolling ~60s window; poll often to maximize capture)
create table if not exists public.ended_auctions (
  auction_id text primary key,
  seller_uuid text not null,
  seller_profile text,
  buyer_uuid text,
  buyer_profile text,
  price bigint not null,
  bin boolean not null default false,
  item_bytes text,
  ended_at timestamptz not null,
  item_id text,
  item_name text,
  item_uuid text,
  minecraft_item_id bigint,
  item_json jsonb
);

create index if not exists ended_auctions_ended_at_idx
  on public.ended_auctions (ended_at desc);

create index if not exists ended_auctions_seller_uuid_idx
  on public.ended_auctions (seller_uuid);

create index if not exists ended_auctions_buyer_uuid_idx
  on public.ended_auctions (buyer_uuid);

-- Existing DBs created before decoded columns (safe to re-run)
alter table public.ended_auctions add column if not exists item_id text;
alter table public.ended_auctions add column if not exists item_name text;
alter table public.ended_auctions add column if not exists item_uuid text;
alter table public.ended_auctions add column if not exists minecraft_item_id bigint;
alter table public.ended_auctions add column if not exists item_json jsonb;

create index if not exists ended_auctions_item_id_idx
  on public.ended_auctions (item_id);

-- ExtraAttributes slice from item_json (immutable). Used by extra_attributes + dye/skin/rune flags.
-- Generated columns may not reference other generated columns, so dye_present etc. call this
-- instead of referencing extra_attributes.
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

-- Browse filters: flat columns so PostgREST can filter reliably (nested `item_json->i->0->...`
-- in query params is brittle; Hypixel also uses either `i[0].tag` or root `tag` shapes).
alter table public.ended_auctions
  add column if not exists extra_attributes jsonb
  generated always as (public.extra_attributes_jsonb(item_json)) stored;

-- Rarity: Hypixel often omits ExtraAttributes.rarity; tier is usually encoded as § + code in tag.display.Name.
create or replace function public.item_rarity_from_item_json(j jsonb)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(
    nullif(trim(j #>> '{i,0,tag,ExtraAttributes,rarity}'), ''),
    nullif(trim(j #>> '{tag,ExtraAttributes,rarity}'), ''),
    substring(
      coalesce(j::text, '')
      from '"rarity"[[:space:]]*:[[:space:]]*"([^"]+)"'
    ),
    case substring(
      coalesce(j #>> '{i,0,tag,display,Name}', j #>> '{tag,display,Name}', '')
      from '§([0-9a-fk-or])'
    )
      when 'f' then 'COMMON'
      when '7' then 'COMMON'
      when '8' then 'COMMON'
      when 'a' then 'UNCOMMON'
      when '9' then 'RARE'
      when '5' then 'EPIC'
      when '6' then 'LEGENDARY'
      when 'd' then 'MYTHIC'
      when 'b' then 'DIVINE'
      when 'c' then 'SPECIAL'
      else null
    end
  );
$$;

alter table public.ended_auctions
  add column if not exists item_rarity text
  generated always as (public.item_rarity_from_item_json(item_json)) stored;

alter table public.ended_auctions
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

create index if not exists ended_auctions_item_rarity_idx
  on public.ended_auctions (item_rarity);

create index if not exists ended_auctions_upgrade_level_idx
  on public.ended_auctions (item_upgrade_level);

-- Browse: "Dye (any) / Skin (any) / Rune (any)" — jsonb ? / runes object (reliable vs PostgREST ->> chains)
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

-- Optional: distinct filter hints for /api/browse/hints (enchant keys, modifiers, …)
-- See browse_filter_hints.sql

-- BIN listings first seen via GET /v2/skyblock/auctions (active AH). Duplicates ignored (same auction_id).
create table if not exists public.bin_listings (
  auction_id text primary key,
  seller_uuid text not null,
  seller_profile text,
  starting_bid bigint not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  item_bytes text,
  first_seen_at timestamptz not null default now(),
  item_id text,
  item_name text,
  item_uuid text,
  minecraft_item_id bigint,
  item_json jsonb
);

create index if not exists bin_listings_first_seen_at_idx
  on public.bin_listings (first_seen_at desc);

create index if not exists bin_listings_seller_uuid_idx
  on public.bin_listings (seller_uuid);

create index if not exists bin_listings_item_id_idx
  on public.bin_listings (item_id);

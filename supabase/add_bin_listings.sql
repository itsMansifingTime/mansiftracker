-- First-seen log of BIN listings from GET /v2/skyblock/auctions (active AH).
-- Run once in Supabase SQL editor if not applying full schema.sql.

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
  item_json jsonb,
  is_bin boolean not null default true
);

create index if not exists bin_listings_first_seen_at_idx
  on public.bin_listings (first_seen_at desc);

create index if not exists bin_listings_seller_uuid_idx
  on public.bin_listings (seller_uuid);

create index if not exists bin_listings_item_id_idx
  on public.bin_listings (item_id);

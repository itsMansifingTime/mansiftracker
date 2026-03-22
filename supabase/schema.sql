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

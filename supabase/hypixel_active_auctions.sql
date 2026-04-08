-- Full Hypixel active-auction house snapshot (paginated /v2/skyblock/auctions, no API key).
-- Used to resolve auction UUID → item_bytes without calling /v2/skyblock/auction (which requires API-Key).
-- Run sync via GET /api/sync-active-auctions (service role). Then auction breakdown can read by UUID.

create table if not exists public.hypixel_active_auctions (
  auction_id text primary key,
  item_bytes text,
  is_bin boolean not null default false,
  sync_run_id uuid not null,
  synced_at timestamptz not null default now()
);

create index if not exists hypixel_active_auctions_sync_run_id_idx
  on public.hypixel_active_auctions (sync_run_id);

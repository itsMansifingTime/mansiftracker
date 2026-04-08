-- One row per auction UUID we already posted to Discord (BIN deal scanner dedupe).
-- Apply in Supabase SQL editor if you use BIN_DEAL_ALERT_WEBHOOK_URL.

create table if not exists public.bin_deal_alert_sent (
  auction_id text primary key,
  alerted_at timestamptz not null default now()
);

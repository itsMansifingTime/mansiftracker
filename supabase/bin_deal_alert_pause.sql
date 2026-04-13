-- Pause toggle for BIN deal Discord alerts (link buttons on each alert).
-- Apply in Supabase SQL editor if you use Stop/Resume links.

create table if not exists public.bin_deal_alert_pause (
  id text primary key default 'default',
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.bin_deal_alert_pause (id, paused)
values ('default', false)
on conflict (id) do nothing;

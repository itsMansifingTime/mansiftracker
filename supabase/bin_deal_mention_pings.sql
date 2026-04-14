-- Cap @mentions on BIN deal Discord webhooks (see BIN_DEAL_ALERT_MENTION_MAX_PINGS).
-- Apply in Supabase SQL editor alongside other bin_deal_* migrations.

create table if not exists public.bin_deal_mention_pings (
  id text primary key default 'default',
  sent_with_mention_count int not null default 0
);

insert into public.bin_deal_mention_pings (id, sent_with_mention_count)
values ('default', 0)
on conflict (id) do nothing;

create or replace function public.try_reserve_deal_mention_ping(p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bin_deal_mention_pings
  set sent_with_mention_count = sent_with_mention_count + 1
  where id = 'default' and sent_with_mention_count < p_max;
  return found;
end;
$$;

create or replace function public.release_deal_mention_ping()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bin_deal_mention_pings
  set sent_with_mention_count = greatest(0, sent_with_mention_count - 1)
  where id = 'default';
end;
$$;

grant execute on function public.try_reserve_deal_mention_ping(int) to service_role;
grant execute on function public.release_deal_mention_ping() to service_role;

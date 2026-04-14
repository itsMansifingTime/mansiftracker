-- Cap Discord webhook sends for BIN deal alerts + test pings.
-- Apply in Supabase SQL editor alongside other bin_deal_* migrations.

create table if not exists public.bin_deal_webhook_pings (
  id text primary key default 'default',
  sent_count int not null default 0
);

insert into public.bin_deal_webhook_pings (id, sent_count)
values ('default', 0)
on conflict (id) do nothing;

create or replace function public.try_reserve_deal_webhook_ping(p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bin_deal_webhook_pings
  set sent_count = sent_count + 1
  where id = 'default' and sent_count < p_max;
  return found;
end;
$$;

create or replace function public.release_deal_webhook_ping()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bin_deal_webhook_pings
  set sent_count = greatest(0, sent_count - 1)
  where id = 'default';
end;
$$;

grant execute on function public.try_reserve_deal_webhook_ping(int) to service_role;
grant execute on function public.release_deal_webhook_ping() to service_role;

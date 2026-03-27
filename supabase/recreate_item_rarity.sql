-- Run once in Supabase SQL Editor if item_rarity was created by an older schema.sql
-- (ExtraAttributes.rarity-only). That left most rows NULL. This recreates the column
-- using item_rarity_from_item_json(), which also reads § color codes from display.Name.

drop index if exists public.ended_auctions_item_rarity_idx;
alter table public.ended_auctions drop column if exists item_rarity;

-- Recreate function + column (function is also in schema.sql; safe to replace)
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
  add column item_rarity text
  generated always as (public.item_rarity_from_item_json(item_json)) stored;

create index if not exists ended_auctions_item_rarity_idx
  on public.ended_auctions (item_rarity);

-- Run in Supabase SQL editor (once). Exposes distinct filter hints from stored rows.
-- Used by GET /api/browse/hints — no need to manually list every enchant/modifier.

create or replace function public.browse_filter_hints()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enchant_keys', coalesce(
      (
        select to_jsonb(coalesce(array_agg(x order by x), array[]::text[]))
        from (
          select distinct k as x
          from (
            select jsonb_object_keys(extra_attributes->'enchantments') as k
            from public.ended_auctions
            where extra_attributes is not null
              and extra_attributes ? 'enchantments'
              and jsonb_typeof(extra_attributes->'enchantments') = 'object'
          ) ek
        ) s
      ),
      '[]'::jsonb
    ),
    'modifiers', coalesce(
      (
        select to_jsonb(coalesce(array_agg(x order by x), array[]::text[]))
        from (
          select distinct trim(extra_attributes->>'modifier') as x
          from public.ended_auctions
          where extra_attributes is not null
            and nullif(trim(extra_attributes->>'modifier'), '') is not null
        ) m
      ),
      '[]'::jsonb
    ),
    'item_rarities', coalesce(
      (
        select to_jsonb(coalesce(array_agg(x order by x), array[]::text[]))
        from (
          select distinct item_rarity as x
          from public.ended_auctions
          where item_rarity is not null
            and trim(item_rarity) <> ''
        ) r
      ),
      '[]'::jsonb
    ),
    'item_ids', coalesce(
      (
        select to_jsonb(coalesce(array_agg(x order by x), array[]::text[]))
        from (
          select distinct item_id as x
          from public.ended_auctions
          where item_id is not null
            and trim(item_id) <> ''
          order by item_id
          limit 8000
        ) i
      ),
      '[]'::jsonb
    ),
    'extra_attribute_keys', coalesce(
      (
        select to_jsonb(coalesce(array_agg(x order by x), array[]::text[]))
        from (
          select x
          from (
            select distinct k as x
            from (
              select jsonb_object_keys(extra_attributes) as k
              from public.ended_auctions
              where extra_attributes is not null
                and jsonb_typeof(extra_attributes) = 'object'
            ) ek
          ) d
          order by x
          limit 5000
        ) limited
      ),
      '[]'::jsonb
    )
  );
$$;

-- Server (service role) calls this via /api/browse/hints
grant execute on function public.browse_filter_hints() to service_role;

import { NextResponse } from "next/server";
import {
  applyBrowseFiltersToQuery,
  parseBrowseFiltersParam,
} from "@/lib/browse-filters";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** Columns for list (no raw item_bytes — large). */
const LIST_SELECT =
  "auction_id, seller_uuid, seller_profile, buyer_uuid, buyer_profile, price, bin, ended_at, item_id, item_name, item_uuid, minecraft_item_id";

const DETAIL_SELECT = `${LIST_SELECT}, item_json`;

const MAX_Q_LEN = 120;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

/** Strip chars that break PostgREST `or()` / LIKE patterns. */
function sanitizeSearch(q: string): string {
  return q.replace(/[%_,*()]/g, "").slice(0, MAX_Q_LEN).trim();
}

export async function GET(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const auctionId = searchParams.get("auctionId")?.trim();

  if (auctionId) {
    const { data, error } = await supabase
      .from("ended_auctions")
      .select(DETAIL_SELECT)
      .eq("auction_id", auctionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ row: data });
  }

  const rawQ = searchParams.get("q") ?? "";
  const q = sanitizeSearch(rawQ);
  const browseFilters = parseBrowseFiltersParam(
    searchParams.get("filters")
  );
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * limit;

  let query = supabase
    .from("ended_auctions")
    .select(LIST_SELECT, { count: "exact" })
    .order("ended_at", { ascending: false });

  if (q.length > 0) {
    const p = `%${q}%`;
    query = query.or(
      `item_name.ilike."${p}",item_id.ilike."${p}",item_rarity.ilike."${p}",auction_id.ilike."${p}",seller_uuid.ilike."${p}",buyer_uuid.ilike."${p}"`
    );
  }

  query = applyBrowseFiltersToQuery(query, browseFilters);

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    const msg = error.message ?? "";
    const hint = /item_rarity|extra_attributes|item_upgrade_level|dye_present|skin_present|rune_present|PGRST204|schema cache/i.test(
      msg
    )
      ? "Apply the latest supabase/schema.sql (or supabase/add_dye_skin_rune_present.sql) in the Supabase SQL editor, then reload the API schema cache (Supabase → Settings → API)."
      : undefined;
    return NextResponse.json(
      { error: msg, ...(hint ? { hint } : {}) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
    limit,
    offset,
    page,
    totalPages: count != null ? Math.max(1, Math.ceil(count / limit)) : 1,
  });
}

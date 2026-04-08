import { NextResponse } from "next/server";
import {
  applyBrowseFiltersToBinListingsQuery,
  parseBrowseFiltersParam,
} from "@/lib/browse-filters";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const LIST_SELECT =
  "auction_id, seller_uuid, seller_profile, starting_bid, start_at, end_at, first_seen_at, item_id, item_name, item_uuid, minecraft_item_id, is_bin";

const DETAIL_SELECT = `${LIST_SELECT}, item_json`;

const MAX_Q_LEN = 120;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

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
      .from("bin_listings")
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
  const browseFilters = parseBrowseFiltersParam(searchParams.get("filters"));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT
    )
  );
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * limit;

  let query = supabase
    .from("bin_listings")
    .select(LIST_SELECT, { count: "exact" })
    .order("first_seen_at", { ascending: false });

  if (q.length > 0) {
    const p = `%${q}%`;
    query = query.or(
      `item_name.ilike."${p}",item_id.ilike."${p}",auction_id.ilike."${p}",seller_uuid.ilike."${p}"`
    );
  }

  query = applyBrowseFiltersToBinListingsQuery(query, browseFilters);

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    const msg = error.message ?? "";
    const hint = /item_rarity|extra_attributes|item_upgrade_level|dye_present|skin_present|rune_present|PGRST204|schema cache|is_bin/i.test(
      msg
    )
      ? "Apply supabase/add_bin_listings_browse_columns.sql (and schema.sql for `extra_attributes_jsonb` functions) in the Supabase SQL editor, then reload the API schema cache."
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

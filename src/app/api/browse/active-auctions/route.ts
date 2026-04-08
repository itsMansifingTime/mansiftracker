import { NextResponse } from "next/server";
import { decodeSkyblockItemBytes } from "@/lib/decode-item-bytes";
import { normalizeUuid } from "@/lib/mojang";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const LIST_SELECT = "auction_id, is_bin, synced_at";
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
  const auctionIdRaw = searchParams.get("auctionId")?.trim();

  if (auctionIdRaw) {
    const auctionId = normalizeUuid(auctionIdRaw);
    const { data, error } = await supabase
      .from("hypixel_active_auctions")
      .select("auction_id, is_bin, synced_at, item_bytes")
      .eq("auction_id", auctionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let item_json: unknown = null;
    if (data.item_bytes) {
      try {
        const decoded = await decodeSkyblockItemBytes(data.item_bytes);
        item_json = decoded.fullNbt;
      } catch {
        item_json = null;
      }
    }

    const { item_bytes: _omit, ...rest } = data;
    return NextResponse.json({
      row: { ...rest, item_json },
    });
  }

  const rawQ = searchParams.get("q") ?? "";
  const q = sanitizeSearch(rawQ);
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
    .from("hypixel_active_auctions")
    .select(LIST_SELECT, { count: "exact" })
    .order("synced_at", { ascending: false });

  if (q.length > 0) {
    const p = `%${q}%`;
    query = query.ilike("auction_id", p);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint:
          /hypixel_active_auctions|PGRST205/i.test(error.message)
            ? "Run supabase/hypixel_active_auctions.sql in the Supabase SQL editor."
            : undefined,
      },
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

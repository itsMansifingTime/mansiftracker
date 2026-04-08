import { NextResponse } from "next/server";
import {
  computeAuctionBreakdownFromItemBytes,
  type BazaarPriceMode,
} from "@/lib/auction-breakdown";
import type { HyperionCraftVerifyRow } from "@/lib/hyperion-craft-verify";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const BATCH = 6;

/**
 * Recent Hyperion rows from `bin_listings` with live craft-cost breakdown (for verification).
 * Query: `limit` (default 25, max 50), `offset`, `bazaarMode` = instant_buy | instant_sell (default instant_sell).
 */
export async function GET(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT
    )
  );
  const offset = Math.max(
    0,
    Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0
  );
  const modeRaw = searchParams.get("bazaarMode")?.trim().toLowerCase();
  const bazaarPriceMode: BazaarPriceMode =
    modeRaw === "instant_buy" ? "instant_buy" : "instant_sell";

  const { data: rows, error, count } = await supabase
    .from("bin_listings")
    .select("auction_id, starting_bid, first_seen_at, item_name, item_bytes", {
      count: "exact",
    })
    .eq("item_id", "HYPERION")
    .order("first_seen_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: /bin_listings|PGRST205/i.test(error.message)
          ? "Run supabase/add_bin_listings.sql if the table is missing."
          : undefined,
      },
      { status: 500 }
    );
  }

  const list = rows ?? [];
  const out: HyperionCraftVerifyRow[] = [];

  for (let i = 0; i < list.length; i += BATCH) {
    const chunk = list.slice(i, i + BATCH);
    const batch = await Promise.all(
      chunk.map(async (row): Promise<HyperionCraftVerifyRow> => {
        const startingBid = Math.floor(Number(row.starting_bid));
        const base = {
          auction_id: row.auction_id,
          starting_bid: startingBid,
          first_seen_at: row.first_seen_at,
          item_name: row.item_name,
          bazaar_price_mode: bazaarPriceMode,
          craft_total: null,
          margin: null,
          error: null as string | null,
          notes: null as string[] | null,
          sections: null as HyperionCraftVerifyRow["sections"],
        };

        if (!row.item_bytes?.trim()) {
          return {
            ...base,
            error: "Missing item_bytes",
          };
        }

        const breakdown = await computeAuctionBreakdownFromItemBytes(
          row.auction_id,
          row.item_bytes,
          { bazaarPriceMode }
        );

        if (breakdown.error) {
          return {
            ...base,
            error: breakdown.error,
            notes: breakdown.notes ?? null,
          };
        }

        const craft = breakdown.total;
        const margin = craft - startingBid;
        return {
          ...base,
          craft_total: craft,
          margin,
          notes: breakdown.notes ?? null,
          sections: breakdown.sections.map((s) => ({
            id: s.id,
            title: s.title,
            subtotal: s.subtotal,
          })),
        };
      })
    );
    out.push(...batch);
  }

  return NextResponse.json({
    rows: out,
    totalMatching: count ?? out.length,
    limit,
    offset,
    bazaar_price_mode: bazaarPriceMode,
  });
}

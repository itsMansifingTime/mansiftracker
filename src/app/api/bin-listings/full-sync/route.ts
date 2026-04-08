import { NextResponse } from "next/server";

import { runFullBinListingsSnapshot } from "@/lib/bin-listings-full-sync";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

/**
 * POST: full Hypixel active-auctions crawl → decode all BINs → replace `bin_listings` snapshot
 * (delete existing rows, then upsert current AH). Requires Supabase service role.
 */
export async function POST() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 503 }
    );
  }

  const result = await runFullBinListingsSnapshot(supabase, {
    replaceSnapshot: true,
  });

  if (!result.ok) {
    const status = result.error.includes("Hypixel") ? 502 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  const d = result.data;
  return NextResponse.json({
    ok: true,
    dealStreaming: false as const,
    skipSupabase: false as const,
    fullSnapshotReplace: true as const,
    pagesFetched: d.pagesFetched,
    totalPagesAvailable: d.totalPagesAvailable,
    activeAuctionsScanned: d.activeAuctionsScanned,
    binAuctionsProcessed: d.binAuctionsProcessed,
    rowsUpserted: d.rowsUpserted,
    upsertChunks: d.upsertChunks,
    ...(d.binListingsUpsertSkipped
      ? {
          binListingsUpsertSkipped: true as const,
          hint: "Run supabase/schema.sql (bin_listings) or supabase/add_bin_listings.sql in Supabase.",
        }
      : {}),
  });
}

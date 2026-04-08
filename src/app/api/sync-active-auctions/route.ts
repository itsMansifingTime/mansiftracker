import { NextResponse } from "next/server";
import { syncHypixelActiveAuctionsToSupabase } from "@/lib/sync-active-auctions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Manual / cron: full Hypixel active AH → Supabase.
 * Craft breakdown also calls `maybeSyncActiveAuctionsBeforeBreakdown` by default.
 *
 * Query: `maxPages` — optional cap (e.g. `5` for pages 0–4 only).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const maxPagesRaw = searchParams.get("maxPages");
  const maxPages =
    maxPagesRaw !== null && maxPagesRaw !== ""
      ? Math.max(1, Math.min(500, Number.parseInt(maxPagesRaw, 10) || 1))
      : null;

  const result = await syncHypixelActiveAuctionsToSupabase({
    maxPages: maxPages ?? undefined,
  });

  if (!result.ok) {
    const status =
      result.error === "Supabase not configured" ? 503 : result.error.startsWith("Hypixel") ? 502 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    syncRunId: result.syncRunId,
    pagesFetched: result.pagesFetched,
    totalPagesAvailable: result.totalPagesAvailable,
    activeAuctionsUpserted: result.activeAuctionsUpserted,
  });
}

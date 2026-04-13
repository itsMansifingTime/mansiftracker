import { NextResponse } from "next/server";

import {
  binDealAlertsEnabled,
  parseBinDealScannerEnv,
} from "@/lib/bin-deal-scanner";
import { fetchDealAlertsPaused } from "@/lib/bin-deal-pause";
import {
  HYPIXEL_AUCTIONS,
  parseSkipSupabaseSearchParam,
  runStreamingDealScan,
  type ActiveAuctionsPage,
} from "@/lib/track-bin-streaming";
import { runFullBinListingsSnapshot } from "@/lib/bin-listings-full-sync";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

/** Fast deal path: never scan more than this many Hypixel pages (0-based … cap−1). */
const DEAL_STREAM_PAGE_CAP = 5;

/**
 * Scans Hypixel active `/v2/skyblock/auctions`, keeps BIN rows, upserts `bin_listings`.
 *
 * **Deal alerts on:** first min(`DEAL_STREAM_PAGE_CAP`, `maxPages` or default, total pages) Hypixel pages — **streaming**: each BIN is decoded,
 * upserted, then craft + Discord runs for allowlist hits before the next auction (fast ping).
 *
 * **Deal alerts off:** full paginated fetch, parallel decode, chunked upsert (full AH to DB).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const skipSupabase = parseSkipSupabaseSearchParam(searchParams);
  const supabase = skipSupabase ? null : getSupabaseAdmin();

  if (!skipSupabase && !supabase) {
    return NextResponse.json(
      {
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 503 }
    );
  }

  const dealCfg = parseBinDealScannerEnv();
  const dealEnabled = binDealAlertsEnabled(dealCfg);

  let maxPages: number | null =
    searchParams.get("maxPages") !== null &&
    searchParams.get("maxPages") !== ""
      ? Math.max(
          1,
          Math.min(500, Number.parseInt(searchParams.get("maxPages")!, 10) || 1)
        )
      : null;

  if (maxPages === null && dealEnabled) {
    const raw = process.env.BIN_DEAL_SCAN_DEFAULT_MAX_PAGES?.trim();
    if (raw !== undefined && raw !== "") {
      maxPages = Math.max(1, Math.min(500, Number.parseInt(raw, 10) || 1));
    }
  }

  const firstRes = await fetch(`${HYPIXEL_AUCTIONS}?page=0`, {
    cache: "no-store",
  });
  if (!firstRes.ok) {
    return NextResponse.json(
      { error: `Hypixel auctions HTTP ${firstRes.status}` },
      { status: 502 }
    );
  }

  const first = (await firstRes.json()) as ActiveAuctionsPage;
  if (!first.success || !first.auctions) {
    return NextResponse.json(
      { error: "Hypixel auctions invalid response (page 0)" },
      { status: 502 }
    );
  }

  const totalPages = first.totalPages ?? 1;

  if (dealEnabled) {
    const requested = maxPages ?? 5;
    const streamPageLimit = Math.min(requested, DEAL_STREAM_PAGE_CAP, totalPages);
    try {
      const dealAlertsPaused = await fetchDealAlertsPaused(supabase);
      const stream = await runStreamingDealScan(
        supabase,
        dealCfg,
        dealAlertsPaused,
        streamPageLimit,
        first,
        skipSupabase
      );
      return NextResponse.json({
        ok: true,
        dealStreaming: true as const,
        skipSupabase,
        pagesFetched: stream.pagesFetched,
        totalPagesAvailable: stream.totalPagesAvailable,
        activeAuctionsScanned: stream.activeAuctionsScanned,
        binAuctionsProcessed: stream.binAuctionsProcessed,
        upsertChunks: null,
        dealAlertsConfigured: true,
        dealAlertsPaused,
        dealAlerts: stream.dealAlerts,
        ...(stream.binListingsUpsertSkipped
          ? {
              binListingsUpsertSkipped: true as const,
              hint: "Run supabase/schema.sql (bin_listings) or supabase/add_bin_listings.sql in Supabase.",
            }
          : {}),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const pageLimit =
    maxPages !== null ? Math.min(maxPages, totalPages) : totalPages;

  const sync = await runFullBinListingsSnapshot(supabase, {
    replaceSnapshot: false,
    skipSupabase,
    pagesToFetch: pageLimit,
    firstPage: first,
  });
  if (!sync.ok) {
    const status = sync.error.includes("Hypixel") ? 502 : 500;
    return NextResponse.json({ error: sync.error }, { status });
  }
  const d = sync.data;

  return NextResponse.json({
    ok: true,
    dealStreaming: false as const,
    skipSupabase,
    pagesFetched: d.pagesFetched,
    totalPagesAvailable: d.totalPagesAvailable,
    activeAuctionsScanned: d.activeAuctionsScanned,
    binAuctionsProcessed: d.binAuctionsProcessed,
    upsertChunks: d.upsertChunks,
    ...(d.binListingsUpsertSkipped
      ? {
          binListingsUpsertSkipped: true as const,
          hint: "Run supabase/schema.sql (bin_listings) or supabase/add_bin_listings.sql in Supabase.",
        }
      : {}),
    dealAlertsConfigured: false,
  });
}

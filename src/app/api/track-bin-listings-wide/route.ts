import { NextResponse } from "next/server";

import {
  binDealAlertsEnabled,
  parseWideBinDealScannerEnv,
} from "@/lib/bin-deal-scanner";
import {
  HYPIXEL_AUCTIONS,
  parseSkipSupabaseSearchParam,
  runStreamingDealScan,
  type ActiveAuctionsPage,
} from "@/lib/track-bin-streaming";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

/** Fixed Hypixel page count for the wide-item scan (pages 0 … WIDE_SCAN_PAGES − 1). */
const WIDE_SCAN_PAGES = 3;

/**
 * Streaming deal scan with **separate** allowlist (`BIN_DEAL_WIDE_ITEM_IDS`).
 * Same mechanics as `/api/track-bin-listings` deal mode, but always caps at {@link WIDE_SCAN_PAGES} pages.
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

  const dealCfg = parseWideBinDealScannerEnv();
  if (!binDealAlertsEnabled(dealCfg)) {
    return NextResponse.json(
      {
        error:
          "Wide scan needs BIN_DEAL_WIDE_ITEM_IDS (or BIN_DEAL_KUUDRA_ARMOR_MIN_MARGIN_COINS) and a webhook (BIN_DEAL_WIDE_WEBHOOK_URL or BIN_DEAL_ALERT_WEBHOOK_URL).",
      },
      { status: 400 }
    );
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
  const streamPageLimit = Math.min(WIDE_SCAN_PAGES, totalPages);

  try {
    const stream = await runStreamingDealScan(
      supabase,
      dealCfg,
      streamPageLimit,
      first,
      skipSupabase
    );
    return NextResponse.json({
      ok: true,
      scanMode: "wide" as const,
      dealStreaming: true as const,
      skipSupabase,
      widePages: WIDE_SCAN_PAGES,
      pagesFetched: stream.pagesFetched,
      totalPagesAvailable: stream.totalPagesAvailable,
      activeAuctionsScanned: stream.activeAuctionsScanned,
      binAuctionsProcessed: stream.binAuctionsProcessed,
      dealAlertsConfigured: true,
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

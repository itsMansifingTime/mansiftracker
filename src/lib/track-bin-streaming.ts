import {
  processBinDealAlertForRow,
  type BinDealAlertStats,
  type BinDealScannerEnvConfig,
} from "@/lib/bin-deal-scanner";
import {
  decodeSkyblockItemBytes,
  normalizeHypixelItemBytesRaw,
} from "@/lib/decode-item-bytes";
import { normalizeUuid } from "@/lib/mojang";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_ITEM_BYTES_LEN = 500_000;

export const HYPIXEL_AUCTIONS =
  "https://api.hypixel.net/v2/skyblock/auctions";

/** `skipSupabase=1|true|yes` — no `bin_listings` / deal dedupe tables. */
export function parseSkipSupabaseSearchParam(
  searchParams: URLSearchParams
): boolean {
  const v = searchParams.get("skipSupabase");
  return v === "1" || v === "true" || v === "yes";
}

export type ActiveAuction = {
  uuid: string;
  auctioneer: string;
  profile_id: string;
  start: number;
  end: number;
  starting_bid: number;
  bin?: boolean;
  item_bytes?: unknown;
};

export type ActiveAuctionsPage = {
  success: boolean;
  page: number;
  totalPages: number;
  totalAuctions: number;
  auctions?: ActiveAuction[];
};

export type BinRow = {
  auction_id: string;
  seller_uuid: string;
  seller_profile: string | null;
  starting_bid: number;
  start_at: string;
  end_at: string;
  item_bytes: string | null;
  first_seen_at: string;
  item_id: string | null;
  item_name: string | null;
  item_uuid: string | null;
  minecraft_item_id: number | null;
  item_json: Record<string, unknown> | unknown[] | null;
};

function isSupabaseMissingTableMessage(msg: string): boolean {
  return /could not find the table|PGRST205|schema cache/i.test(msg);
}

export async function fetchAuctionsPage(
  page: number
): Promise<
  { ok: true; data: ActiveAuctionsPage } | { ok: false; error: string; status: number }
> {
  const res = await fetch(`${HYPIXEL_AUCTIONS}?page=${page}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      ok: false,
      error: `Hypixel auctions HTTP ${res.status} (page ${page})`,
      status: 502,
    };
  }
  const data = (await res.json()) as ActiveAuctionsPage;
  if (!data.success || !data.auctions) {
    return {
      ok: false,
      error: `Hypixel auctions invalid response (page ${page})`,
      status: 502,
    };
  }
  return { ok: true, data };
}

export async function decodeBinRow(
  a: ActiveAuction,
  firstSeenAt: string
): Promise<BinRow> {
  const raw = normalizeHypixelItemBytesRaw(a.item_bytes);
  const itemBytes =
    raw && raw.length > MAX_ITEM_BYTES_LEN
      ? raw.slice(0, MAX_ITEM_BYTES_LEN)
      : raw ?? null;

  const decoded = await decodeSkyblockItemBytes(itemBytes);

  return {
    auction_id: normalizeUuid(a.uuid),
    seller_uuid: normalizeUuid(a.auctioneer),
    seller_profile: a.profile_id ?? null,
    starting_bid: Math.floor(a.starting_bid),
    start_at: new Date(a.start).toISOString(),
    end_at: new Date(a.end).toISOString(),
    item_bytes: itemBytes,
    first_seen_at: firstSeenAt,
    item_id: decoded.itemId,
    item_name: decoded.itemName,
    item_uuid: decoded.itemUuid,
    minecraft_item_id: decoded.minecraftItemId,
    item_json: decoded.fullNbt,
  };
}

/**
 * Streaming deal path: each BIN decoded in order; optional `bin_listings` upsert;
 * allowlisted tags get craft + Discord via {@link processBinDealAlertForRow}.
 */
export async function runStreamingDealScan(
  supabase: SupabaseClient | null,
  dealCfg: BinDealScannerEnvConfig,
  streamPageLimit: number,
  firstPage: ActiveAuctionsPage,
  skipSupabase: boolean
): Promise<{
  binListingsUpsertSkipped: boolean;
  dealAlerts: BinDealAlertStats;
  pagesFetched: number;
  totalPagesAvailable: number;
  activeAuctionsScanned: number;
  binAuctionsProcessed: number;
}> {
  const totalPages = firstPage.totalPages ?? 1;
  const pageLimit = Math.min(streamPageLimit, totalPages);
  const firstSeenAt = new Date().toISOString();

  const dealAlerts: BinDealAlertStats = {
    candidates: 0,
    craftChecks: 0,
    alertsSent: 0,
    skippedAlreadyAlerted: 0,
    skippedBelowMargin: 0,
    skippedNecronBladeListingOverBinCap: 0,
    skippedErrors: 0,
    discordErrors: [],
  };
  const dedupeState = { dedupeSkipped: false };
  let binListingsUpsertSkipped = false;

  let activeAuctionsScanned = 0;
  let binAuctionsProcessed = 0;

  for (let p = 0; p < pageLimit; p++) {
    let resolved: ActiveAuctionsPage;
    if (p === 0) {
      resolved = firstPage;
    } else {
      const got = await fetchAuctionsPage(p);
      if (!got.ok) {
        throw new Error(got.error);
      }
      resolved = got.data;
    }

    activeAuctionsScanned += resolved.auctions?.length ?? 0;

    for (const a of resolved.auctions ?? []) {
      if (!a.bin) continue;
      binAuctionsProcessed++;
      const row = await decodeBinRow(a, firstSeenAt);
      if (!skipSupabase && supabase && !binListingsUpsertSkipped) {
        const { error } = await supabase.from("bin_listings").upsert([row], {
          onConflict: "auction_id",
          ignoreDuplicates: true,
        });
        if (error) {
          if (isSupabaseMissingTableMessage(error.message)) {
            binListingsUpsertSkipped = true;
          } else {
            throw new Error(error.message);
          }
        }
      }
      const tag = row.item_id?.trim().toUpperCase();
      if (tag && dealCfg.itemIds.has(tag)) {
        await processBinDealAlertForRow(
          skipSupabase ? null : supabase,
          {
            auction_id: row.auction_id,
            item_bytes: row.item_bytes,
            starting_bid: row.starting_bid,
            item_id: row.item_id,
            auction_start_ms:
              typeof a.start === "number" && Number.isFinite(a.start)
                ? a.start
                : undefined,
          },
          dealCfg,
          dedupeState,
          dealAlerts
        );
      }
    }
  }

  return {
    binListingsUpsertSkipped,
    dealAlerts,
    pagesFetched: pageLimit,
    totalPagesAvailable: totalPages,
    activeAuctionsScanned,
    binAuctionsProcessed,
  };
}

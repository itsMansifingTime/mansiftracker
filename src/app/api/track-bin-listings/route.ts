import { NextResponse } from "next/server";
import {
  decodeSkyblockItemBytes,
  normalizeHypixelItemBytesRaw,
} from "@/lib/decode-item-bytes";
import { normalizeUuid } from "@/lib/mojang";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_ITEM_BYTES_LEN = 500_000;
const HYPIXEL_AUCTIONS = "https://api.hypixel.net/v2/skyblock/auctions";
const UPSERT_CHUNK = 200;

type ActiveAuction = {
  uuid: string;
  auctioneer: string;
  profile_id: string;
  start: number;
  end: number;
  starting_bid: number;
  bin?: boolean;
  item_bytes?: unknown;
};

type ActiveAuctionsPage = {
  success: boolean;
  page: number;
  totalPages: number;
  totalAuctions: number;
  auctions?: ActiveAuction[];
};

/**
 * Scans Hypixel active `/v2/skyblock/auctions` (all pages by default), keeps
 * rows with `bin === true`, decodes item NBT like `track-sales`, and upserts
 * into `bin_listings` (first-seen only; duplicates ignored).
 *
 * Query: `maxPages` — optional cap (e.g. `10` for pages 0–9 only).
 */
export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const maxPagesRaw = searchParams.get("maxPages");
  const maxPages =
    maxPagesRaw !== null && maxPagesRaw !== ""
      ? Math.max(1, Math.min(500, Number.parseInt(maxPagesRaw, 10) || 1))
      : null;

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
  const pageLimit =
    maxPages !== null ? Math.min(maxPages, totalPages) : totalPages;

  const allAuctions: ActiveAuction[] = [...first.auctions];

  for (let p = 1; p < pageLimit; p++) {
    const res = await fetch(`${HYPIXEL_AUCTIONS}?page=${p}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Hypixel auctions HTTP ${res.status} (page ${p})` },
        { status: 502 }
      );
    }
    const j = (await res.json()) as ActiveAuctionsPage;
    if (!j.success || !j.auctions) {
      return NextResponse.json(
        { error: `Hypixel auctions invalid response (page ${p})` },
        { status: 502 }
      );
    }
    allAuctions.push(...j.auctions);
  }

  const binOnly = allAuctions.filter((a) => a.bin === true);
  const firstSeenAt = new Date().toISOString();

  type Row = {
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

  const rows: Row[] = [];
  const DECODE_PARALLEL = 32;

  for (let i = 0; i < binOnly.length; i += DECODE_PARALLEL) {
    const slice = binOnly.slice(i, i + DECODE_PARALLEL);
    const batch = await Promise.all(
      slice.map(async (a): Promise<Row> => {
        const raw = normalizeHypixelItemBytesRaw(a.item_bytes);
        const itemBytes =
          raw && raw.length > MAX_ITEM_BYTES_LEN
            ? raw.slice(0, MAX_ITEM_BYTES_LEN)
            : raw ?? null;

        const decoded = await decodeSkyblockItemBytes(itemBytes);

        return {
          auction_id: a.uuid,
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
      })
    );
    rows.push(...batch);
  }

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from("bin_listings").upsert(chunk, {
      onConflict: "auction_id",
      ignoreDuplicates: true,
    });
    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          upsertChunkIndex: Math.floor(i / UPSERT_CHUNK),
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    pagesFetched: pageLimit,
    totalPagesAvailable: totalPages,
    activeAuctionsScanned: allAuctions.length,
    binAuctionsProcessed: binOnly.length,
    upsertChunks: Math.ceil(rows.length / UPSERT_CHUNK) || 0,
  });
}

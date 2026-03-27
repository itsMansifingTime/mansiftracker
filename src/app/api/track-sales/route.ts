import { NextResponse } from "next/server";
import { decodeSkyblockItemBytes } from "@/lib/decode-item-bytes";
import { normalizeUuid } from "@/lib/mojang";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cap stored item bytes to avoid oversized rows (full NBT can be large). */
const MAX_ITEM_BYTES_LEN = 500_000;

type EndedAuction = {
  auction_id: string;
  seller: string;
  seller_profile?: string;
  buyer?: string;
  buyer_profile?: string;
  price: number;
  bin: boolean;
  item_bytes?: string;
  timestamp: number;
};

type AuctionsEndedResponse = {
  success: boolean;
  auctions?: EndedAuction[];
};

/**
 * Logs every auction returned by Hypixel `auctions_ended` (rolling ~60s window).
 * Poll every few seconds to maximize capture; Hypixel does not expose full history
 * or “listed” events—only recently ended auctions.
 */
export async function GET() {
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

  const endedRes = await fetch(
    "https://api.hypixel.net/v2/skyblock/auctions_ended",
    { cache: "no-store" }
  );
  if (!endedRes.ok) {
    return NextResponse.json(
      { error: `Hypixel auctions_ended HTTP ${endedRes.status}` },
      { status: 502 }
    );
  }

  const ended = (await endedRes.json()) as AuctionsEndedResponse;
  if (!ended.success || !ended.auctions) {
    return NextResponse.json(
      { error: "Hypixel auctions_ended invalid response" },
      { status: 502 }
    );
  }

  let inserted = 0;
  let skipped = 0;

  for (const a of ended.auctions) {
    const rawBytes = a.item_bytes;
    const itemBytes =
      rawBytes && rawBytes.length > MAX_ITEM_BYTES_LEN
        ? rawBytes.slice(0, MAX_ITEM_BYTES_LEN)
        : rawBytes ?? null;

    const decoded = await decodeSkyblockItemBytes(itemBytes);

    const { error } = await supabase.from("ended_auctions").insert({
      auction_id: a.auction_id,
      seller_uuid: normalizeUuid(a.seller),
      seller_profile: a.seller_profile ?? null,
      buyer_uuid: a.buyer ? normalizeUuid(a.buyer) : null,
      buyer_profile: a.buyer_profile ?? null,
      price: Math.floor(a.price),
      bin: !!a.bin,
      item_bytes: itemBytes,
      ended_at: new Date(a.timestamp).toISOString(),
      item_id: decoded.itemId,
      item_name: decoded.itemName,
      item_uuid: decoded.itemUuid,
      minecraft_item_id: decoded.minecraftItemId,
      item_json: decoded.fullNbt,
    });

    if (error?.code === "23505") {
      skipped++;
      continue;
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted++;
  }

  return NextResponse.json({
    ok: true,
    scanned: ended.auctions.length,
    inserted,
    skippedDuplicates: skipped,
  });
}

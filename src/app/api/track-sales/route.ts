import { NextResponse } from "next/server";
import {
  computeCraftCost,
  TRACKER_SNAPSHOT_OPTIONS,
} from "@/lib/calculator";
import { itemBytesContainsHyperion } from "@/lib/hyperion-item";
import { normalizeUuid, uuidFromUsername } from "@/lib/mojang";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type EndedAuction = {
  auction_id: string;
  seller: string;
  price: number;
  bin: boolean;
  item_bytes: string;
  timestamp: number;
};

type AuctionsEndedResponse = {
  success: boolean;
  auctions?: EndedAuction[];
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim() || "bowpotato";

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

  const profile = await uuidFromUsername(username);
  if (!profile) {
    return NextResponse.json(
      { error: `Unknown Minecraft username: ${username}` },
      { status: 404 }
    );
  }

  const target = normalizeUuid(profile.id);

  const endedRes = await fetch(
    "https://api.hypixel.net/v2/skyblock/auctions_ended",
    { next: { revalidate: 0 } }
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

  const { total: craftSnapshot } = await computeCraftCost(
    TRACKER_SNAPSHOT_OPTIONS
  );

  let inserted = 0;
  let skipped = 0;

  for (const a of ended.auctions) {
    if (!a.bin) continue;
    if (normalizeUuid(a.seller) !== target) continue;

    const soldPrice = Math.floor(a.price);
    const isHyperion = itemBytesContainsHyperion(a.item_bytes);
    const craftCost = isHyperion ? craftSnapshot : 0;
    const overCraft = soldPrice - craftCost;

    const { error } = await supabase.from("sold_hyperions").insert({
      auction_id: a.auction_id,
      seller_uuid: target,
      seller_name: profile.name,
      sold_price: soldPrice,
      craft_cost_snapshot: craftCost,
      over_craft: overCraft,
      timestamp: new Date(a.timestamp).toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        skipped++;
        continue;
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted++;
  }

  return NextResponse.json({
    ok: true,
    username: profile.name,
    sellerUuid: target,
    scanned: ended.auctions.length,
    inserted,
    skippedDuplicates: skipped,
    craftCostSnapshot: craftSnapshot,
  });
}

import { NextResponse } from "next/server";

import { computeAuctionBreakdownFromItemBytes } from "@/lib/auction-breakdown";
import { decodeSkyblockItemBytes } from "@/lib/decode-item-bytes";
import { normalizeSkyblockItemId } from "@/lib/gemstone-slots";
import { normalizeUuid, uuidFromUsername } from "@/lib/mojang";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENDED_AUCTIONS_URL = "https://api.hypixel.net/v2/skyblock/auctions_ended";
const MAX_ITEM_BYTES_LEN = 500_000;
const HYPERION_TAG = "HYPERION";

type EndedAuction = {
  auction_id: string;
  seller: string;
  price: number;
  bin: boolean;
  item_bytes?: string;
  timestamp: number;
};

type AuctionsEndedResponse = {
  success: boolean;
  auctions?: EndedAuction[];
};

const localSeenAuctionIds = new Set<string>();

function authorize(req: Request): boolean {
  const expected =
    process.env.TRACK_MANSIF_HYPERION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!expected) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === expected) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

function rememberLocal(auctionId: string) {
  if (localSeenAuctionIds.size >= 50_000) {
    localSeenAuctionIds.clear();
  }
  localSeenAuctionIds.add(auctionId);
}

function fmtCoins(n: number): string {
  return `${Math.floor(n).toLocaleString("en-US")} coins`;
}

async function postSaleWebhook(
  webhookUrl: string,
  p: {
    sellerName: string;
    auctionId: string;
    soldPrice: number;
    craftCost: number;
    profit: number;
  }
): Promise<void> {
  const coflUrl = `https://sky.coflnet.com/auction/${encodeURIComponent(p.auctionId)}`;
  const color = p.profit >= 0 ? 0x22c55e : 0xef4444;
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: `Hyperion sold: ${p.sellerName}`,
          url: coflUrl,
          color,
          fields: [
            { name: "Item", value: HYPERION_TAG, inline: true },
            { name: "Sold price", value: fmtCoins(p.soldPrice), inline: true },
            { name: "Craft snapshot", value: fmtCoins(p.craftCost), inline: true },
            {
              name: "Profit vs craft",
              value: `${p.profit >= 0 ? "+" : ""}${fmtCoins(p.profit)}`,
              inline: false,
            },
            { name: "Auction UUID", value: `\`${p.auctionId}\``, inline: false },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
}

/**
 * Poll Hypixel `auctions_ended`, detect sold Hyperions by a specific seller, and
 * compute profit against current craft snapshot (`sold_price - craft_cost`).
 *
 * Designed for a dedicated Railway worker polling every ~30s.
 */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. Use TRACK_MANSIF_HYPERION_SECRET or CRON_SECRET via ?secret=… or Authorization: Bearer …",
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const sellerName =
    url.searchParams.get("seller")?.trim() ||
    process.env.TRACK_MANSIF_HYPERION_SELLER?.trim() ||
    "Mansif";
  const sellerProfile = await uuidFromUsername(sellerName);
  if (!sellerProfile) {
    return NextResponse.json(
      { error: `Unknown Minecraft user: ${sellerName}` },
      { status: 400 }
    );
  }
  const sellerUuidNorm = normalizeUuid(sellerProfile.id);

  const endedRes = await fetch(ENDED_AUCTIONS_URL, { cache: "no-store" });
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

  const supabase = getSupabaseAdmin();
  const webhook = process.env.MANSIF_HYPERION_SALES_WEBHOOK_URL?.trim() || null;

  const detected: Array<{
    auctionId: string;
    soldPrice: number;
    craftCostSnapshot: number;
    profitVsCraft: number;
    endedAt: string;
  }> = [];

  let scanned = 0;
  let matchedSeller = 0;
  let hyperions = 0;
  let inserted = 0;
  let skippedDuplicates = 0;
  let webhookSent = 0;

  for (const a of ended.auctions) {
    scanned++;
    if (normalizeUuid(a.seller) !== sellerUuidNorm) continue;
    matchedSeller++;

    const rawBytes = a.item_bytes;
    const itemBytes =
      rawBytes && rawBytes.length > MAX_ITEM_BYTES_LEN
        ? rawBytes.slice(0, MAX_ITEM_BYTES_LEN)
        : rawBytes ?? null;
    const decoded = await decodeSkyblockItemBytes(itemBytes);
    const tag = normalizeSkyblockItemId(decoded.itemId ?? "");
    if (tag !== HYPERION_TAG) continue;
    hyperions++;

    const auctionId = normalizeUuid(a.auction_id);
    let isNew = true;
    if (supabase) {
      const breakdown = await computeAuctionBreakdownFromItemBytes(auctionId, itemBytes, {
        bazaarPriceMode: "instant_sell",
      });
      const craftCost = Math.max(0, Math.floor(breakdown.total || 0));
      const soldPrice = Math.floor(a.price);
      const profit = soldPrice - craftCost;
      const endedAtIso = new Date(a.timestamp).toISOString();

      const { error } = await supabase.from("mansif_hyperion_sales").insert({
        auction_id: auctionId,
        seller_uuid: sellerUuidNorm,
        seller_name: sellerProfile.name,
        sold_price: soldPrice,
        craft_cost_snapshot: craftCost,
        profit_vs_craft: profit,
        ended_at: endedAtIso,
      });

      if (error?.code === "23505") {
        skippedDuplicates++;
        isNew = false;
      } else if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        inserted++;
      }

      if (!isNew) continue;

      detected.push({
        auctionId,
        soldPrice,
        craftCostSnapshot: craftCost,
        profitVsCraft: profit,
        endedAt: endedAtIso,
      });

      if (webhook) {
        await postSaleWebhook(webhook, {
          sellerName: sellerProfile.name,
          auctionId,
          soldPrice,
          craftCost,
          profit,
        });
        webhookSent++;
      }
      continue;
    }

    if (localSeenAuctionIds.has(auctionId)) {
      skippedDuplicates++;
      continue;
    }
    rememberLocal(auctionId);

    const breakdown = await computeAuctionBreakdownFromItemBytes(auctionId, itemBytes, {
      bazaarPriceMode: "instant_sell",
    });
    const craftCost = Math.max(0, Math.floor(breakdown.total || 0));
    const soldPrice = Math.floor(a.price);
    const profit = soldPrice - craftCost;
    const endedAtIso = new Date(a.timestamp).toISOString();

    inserted++;
    detected.push({
      auctionId,
      soldPrice,
      craftCostSnapshot: craftCost,
      profitVsCraft: profit,
      endedAt: endedAtIso,
    });

    if (webhook) {
      await postSaleWebhook(webhook, {
        sellerName: sellerProfile.name,
        auctionId,
        soldPrice,
        craftCost,
        profit,
      });
      webhookSent++;
    }
  }

  return NextResponse.json({
    ok: true,
    seller: { name: sellerProfile.name, uuid: sellerUuidNorm },
    scanned,
    matchedSeller,
    hyperions,
    inserted,
    skippedDuplicates,
    webhookSent,
    detected,
    notes: supabase
      ? ["Deduped via Supabase table mansif_hyperion_sales"]
      : ["Supabase not configured: dedupe is in-memory only for this runtime"],
  });
}

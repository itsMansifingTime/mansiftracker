import { NextResponse } from "next/server";

import { normalizeUuid, uuidFromUsername } from "@/lib/mojang";
import {
  decodeBinRow,
  fetchAuctionsPage,
  HYPIXEL_AUCTIONS,
  type ActiveAuctionsPage,
} from "@/lib/track-bin-streaming";

const COFL_AUCTION_BASE = "https://sky.coflnet.com/auction";

/** Avoid unbounded growth in long-lived workers; dupes after reset are acceptable. */
const MAX_SEEN_IDS = 50_000;
const seenAuctionIds = new Set<string>();

function rememberAuctionOnSuccess(auctionId: string) {
  if (seenAuctionIds.size >= MAX_SEEN_IDS) {
    seenAuctionIds.clear();
  }
  seenAuctionIds.add(auctionId);
}

type PlayerWatchAuth = "ok" | "missing_server_secret" | "unauthorized";

function authorizePlayerWatch(req: Request): PlayerWatchAuth {
  const expected =
    process.env.PLAYER_AUCTION_WATCH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!expected) return "missing_server_secret";
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === expected) return "ok";
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return "ok";
  return "unauthorized";
}

export const dynamic = "force-dynamic";

export const maxDuration = 300;

/**
 * Scans Hypixel active auctions for listings from named seller(s). When a listing UUID
 * is seen for the first time in this runtime, posts to `PLAYER_AUCTION_WATCH_WEBHOOK_URL`.
 *
 * `GET /api/player-auctions-watch?player=Mansif&secret=…` (or `players=a,b`)
 */
export async function GET(req: Request) {
  const auth = authorizePlayerWatch(req);
  if (auth === "missing_server_secret") {
    return NextResponse.json(
      {
        error:
          "Server is missing CRON_SECRET or PLAYER_AUCTION_WATCH_SECRET in Vercel env. This is your app password — not a Hypixel API key. Add one and redeploy.",
      },
      { status: 503 }
    );
  }
  if (auth === "unauthorized") {
    return NextResponse.json(
      {
        error:
          "Wrong site password. Use the same value as CRON_SECRET or PLAYER_AUCTION_WATCH_SECRET from Vercel (not developer.hypixel.net).",
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const qPlayers =
    url.searchParams.get("players")?.trim() ||
    url.searchParams.get("player")?.trim();
  const envPlayers = process.env.PLAYER_AUCTION_WATCH_USERNAMES?.trim();
  const rawList = qPlayers || envPlayers || "";
  const names = rawList
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (names.length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide player or players (comma-separated), or set PLAYER_AUCTION_WATCH_USERNAMES.",
      },
      { status: 400 }
    );
  }

  const webhook = process.env.PLAYER_AUCTION_WATCH_WEBHOOK_URL?.trim();
  if (!webhook) {
    return NextResponse.json(
      { error: "Set PLAYER_AUCTION_WATCH_WEBHOOK_URL" },
      { status: 400 }
    );
  }

  const maxPages = Math.min(
    50,
    Math.max(
      1,
      Number.parseInt(url.searchParams.get("maxPages") || "10", 10) || 10
    )
  );

  const targetUuids = new Map<string, string>();
  for (const name of names) {
    try {
      const prof = await uuidFromUsername(name);
      if (prof) {
        targetUuids.set(normalizeUuid(prof.id), prof.name);
      }
    } catch {
      /* ignore resolution errors per name */
    }
  }

  if (targetUuids.size === 0) {
    return NextResponse.json(
      { error: "Could not resolve any Minecraft username(s)." },
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
  const pageLimit = Math.min(maxPages, totalPages);
  const firstSeenAt = new Date().toISOString();

  let auctionsScanned = 0;
  let rowsFromWatchedSellers = 0;
  let discordPosts = 0;
  const newListings: {
    auctionId: string;
    seller: string;
    itemName: string | null;
  }[] = [];

  for (let p = 0; p < pageLimit; p++) {
    let resolved: ActiveAuctionsPage;
    if (p === 0) {
      resolved = first;
    } else {
      const got = await fetchAuctionsPage(p);
      if (!got.ok) {
        return NextResponse.json({ error: got.error }, { status: 502 });
      }
      resolved = got.data;
    }

    for (const a of resolved.auctions ?? []) {
      auctionsScanned++;
      const sellerNorm = normalizeUuid(a.auctioneer);
      const displayName = targetUuids.get(sellerNorm);
      if (!displayName) continue;

      rowsFromWatchedSellers++;

      const auctionId = normalizeUuid(a.uuid);
      if (seenAuctionIds.has(auctionId)) continue;

      const row = await decodeBinRow(a, firstSeenAt);
      const cofl = `${COFL_AUCTION_BASE}/${encodeURIComponent(auctionId)}`;
      const typeLabel = a.bin ? "BIN" : "Auction";
      const bid = Math.floor(a.starting_bid);

      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: `Listing: ${row.item_name ?? "Unknown item"}`,
              url: cofl,
              color: 0x5865f2,
              fields: [
                { name: "Seller", value: displayName, inline: true },
                { name: "Type", value: typeLabel, inline: true },
                {
                  name: "Starting bid",
                  value: `${bid.toLocaleString("en-US")} coins`,
                  inline: true,
                },
                { name: "Tag", value: row.item_id ?? "—", inline: true },
                {
                  name: "Auction UUID",
                  value: `\`${auctionId}\``,
                  inline: false,
                },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      if (res.ok) {
        rememberAuctionOnSuccess(auctionId);
        discordPosts++;
        newListings.push({
          auctionId,
          seller: displayName,
          itemName: row.item_name,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    resolvedPlayers: Object.fromEntries(targetUuids),
    pagesScanned: pageLimit,
    totalPagesAvailable: totalPages,
    auctionsScanned,
    rowsFromWatchedSellers,
    discordPosts,
    newListings,
  });
}

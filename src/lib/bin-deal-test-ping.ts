import {
  computeDealAlertCraftForRow,
  formatListedDuration,
  parseBinDealScannerEnv,
  postBinDealTestPingEmbed,
  type BinDealRowInput,
} from "./bin-deal-scanner";
import {
  decodeBinRow,
  fetchAuctionsPage,
  HYPIXEL_AUCTIONS,
  type ActiveAuctionsPage,
} from "./track-bin-streaming";

const COFL_AUCTION_BASE = "https://sky.coflnet.com/auction";

/** Same rough window as deal streaming (first pages of AH). */
export const TEST_PING_MAX_PAGES = 5;

export type BinDealTestPingResult =
  | {
      ok: true;
      discordSent: boolean;
      pickedAuctionId: string | null;
      tag: string | null;
      margin: number | null;
      candidatesFound: number;
      pagesSearched: number;
      totalPagesAvailable: number;
      discordError?: string;
    }
  | { ok: false; error: string };

/**
 * Pick a random allowlisted BIN from the first `TEST_PING_MAX_PAGES` Hypixel AH pages,
 * compute craft like real deal alerts, post a labeled TEST embed (ignores margin rules).
 */
export async function runBinDealTestPing(): Promise<BinDealTestPingResult> {
  const cfg = parseBinDealScannerEnv();
  if (cfg.itemIds.size === 0) {
    return { ok: false, error: "BIN_DEAL_ITEM_IDS is empty" };
  }

  const webhook =
    process.env.BIN_DEAL_TEST_PING_WEBHOOK_URL?.trim() ||
    process.env.BIN_DEAL_ALERT_WEBHOOK_URL?.trim() ||
    null;
  if (!webhook) {
    return { ok: false, error: "Set BIN_DEAL_TEST_PING_WEBHOOK_URL or BIN_DEAL_ALERT_WEBHOOK_URL" };
  }

  const firstRes = await fetch(`${HYPIXEL_AUCTIONS}?page=0`, {
    cache: "no-store",
  });
  if (!firstRes.ok) {
    return {
      ok: false,
      error: `Hypixel auctions HTTP ${firstRes.status}`,
    };
  }

  const first = (await firstRes.json()) as ActiveAuctionsPage;
  if (!first.success || !first.auctions) {
    return { ok: false, error: "Hypixel auctions invalid response (page 0)" };
  }

  const totalPages = first.totalPages ?? 1;
  const pageLimit = Math.min(TEST_PING_MAX_PAGES, totalPages);
  const firstSeenAt = new Date().toISOString();
  const pool: BinDealRowInput[] = [];

  for (let p = 0; p < pageLimit; p++) {
    let resolved: ActiveAuctionsPage;
    if (p === 0) {
      resolved = first;
    } else {
      const got = await fetchAuctionsPage(p);
      if (!got.ok) {
        return { ok: false, error: got.error };
      }
      resolved = got.data;
    }

    for (const a of resolved.auctions ?? []) {
      if (!a.bin) continue;
      const row = await decodeBinRow(a, firstSeenAt);
      const tag = row.item_id?.trim().toUpperCase();
      if (!tag || !cfg.itemIds.has(tag)) continue;
      pool.push({
        auction_id: row.auction_id,
        item_bytes: row.item_bytes,
        starting_bid: row.starting_bid,
        item_id: row.item_id,
        auction_start_ms:
          typeof a.start === "number" && Number.isFinite(a.start)
            ? a.start
            : undefined,
      });
    }
  }

  if (pool.length === 0) {
    const mentionRaw = process.env.BIN_DEAL_ALERT_MENTION_USER_ID?.trim();
    const mention =
      mentionRaw && /^\d{17,19}$/.test(mentionRaw)
        ? `<@${mentionRaw}> `
        : "";
    const emptyRes = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `${mention}🧪 **TEST ping:** no allowlisted BIN in the first ${pageLimit} Hypixel AH page(s).`,
      }),
    });
    const emptyOk = emptyRes.ok;
    const emptyErr = emptyOk
      ? undefined
      : `Discord HTTP ${emptyRes.status} ${(await emptyRes.text().catch(() => "")).slice(0, 120)}`;
    return {
      ok: true,
      discordSent: emptyOk,
      pickedAuctionId: null,
      tag: null,
      margin: null,
      candidatesFound: 0,
      pagesSearched: pageLimit,
      totalPagesAvailable: totalPages,
      discordError: emptyErr,
    };
  }

  const row = pool[Math.floor(Math.random() * pool.length)]!;
  const craftResult = await computeDealAlertCraftForRow(row);
  if (!craftResult.ok) {
    return {
      ok: false,
      error: `Craft failed for picked auction ${row.auction_id}: ${craftResult.error}`,
    };
  }

  const { craft, itemName, tag, craftPricingLabel } = craftResult;
  const startingBid = Math.floor(row.starting_bid);
  const margin = craft - startingBid;

  const post = await postBinDealTestPingEmbed(webhook, {
    itemName,
    tag,
    auctionId: row.auction_id,
    startingBid,
    craftCost: craft,
    margin,
    coflUrl: `${COFL_AUCTION_BASE}/${encodeURIComponent(row.auction_id)}`,
    craftPricingLabel,
    listedForLabel: formatListedDuration(row.auction_start_ms),
  });

  return {
    ok: true,
    discordSent: post.ok,
    pickedAuctionId: row.auction_id,
    tag,
    margin,
    candidatesFound: pool.length,
    pagesSearched: pageLimit,
    totalPagesAvailable: totalPages,
    discordError: post.ok ? undefined : post.error,
  };
}

import {
  computeDealAlertCraftForRow,
  formatListedDuration,
  isBinDealAlertTag,
  parseBinDealScannerEnv,
  postBinDealTestPingEmbed,
  terminatorRowPassesDealAlertItemGate,
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

/** Default: only BIN listings with starting bid at least this high (overridable via env). */
export const DEFAULT_TEST_PING_MIN_STARTING_BID_COINS = 50_000_000;

function testPingMinStartingBidCoins(): number {
  const raw = process.env.BIN_DEAL_TEST_PING_MIN_STARTING_BID_COINS?.trim();
  if (raw === "0") return 0;
  if (!raw) return DEFAULT_TEST_PING_MIN_STARTING_BID_COINS;
  const n = Number.parseInt(raw.replace(/_/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TEST_PING_MIN_STARTING_BID_COINS;
}

export type BinDealTestPingResult =
  | {
      ok: true;
      discordSent: boolean;
      pickedAuctionId: string | null;
      tag: string | null;
      margin: number | null;
      candidatesFound: number;
      /** Minimum starting bid (BIN) required to enter the pool this run. */
      minStartingBidCoins: number;
      pagesSearched: number;
      totalPagesAvailable: number;
      discordError?: string;
    }
  | { ok: false; error: string };

/**
 * Pick a random allowlisted BIN from the first `TEST_PING_MAX_PAGES` Hypixel AH pages
 * with starting bid ≥ `BIN_DEAL_TEST_PING_MIN_STARTING_BID_COINS` (default 50M),
 * compute craft like real deal alerts, post a labeled TEST embed (ignores margin rules).
 */
export async function runBinDealTestPing(): Promise<BinDealTestPingResult> {
  const minStartingBidCoins = testPingMinStartingBidCoins();
  const cfg = parseBinDealScannerEnv();
  if (cfg.itemIds.size === 0 && cfg.kuudraArmorMinMarginCoins === 0) {
    return {
      ok: false,
      error:
        "BIN_DEAL_ITEM_IDS is empty and Kuudra deal scan is off (set BIN_DEAL_KUUDRA_ARMOR_MIN_MARGIN_COINS to include Kuudra armor)",
    };
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
      if (!tag || !isBinDealAlertTag(cfg, tag)) continue;
      if (Math.floor(row.starting_bid) < minStartingBidCoins) continue;
      if (
        tag === "TERMINATOR" &&
        !(await terminatorRowPassesDealAlertItemGate(row))
      ) {
        continue;
      }
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
        content: `${mention}🧪 **TEST ping:** no allowlisted BIN ${
          minStartingBidCoins > 0
            ? `≥ ${minStartingBidCoins.toLocaleString("en-US")} coins `
            : ""
        }in the first ${pageLimit} Hypixel AH page(s).`,
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
      minStartingBidCoins,
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
    minStartingBidCoins,
    pagesSearched: pageLimit,
    totalPagesAvailable: totalPages,
    discordError: post.ok ? undefined : post.error,
  };
}

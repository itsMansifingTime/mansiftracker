import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAuctionBreakdownFromItemBytes } from "./auction-breakdown";

/** Deal Discord alerts always price craft with instant sell (`sell_summary`) — not buy-side. */
const DEAL_ALERT_BAZAAR_MODE = "instant_sell" as const;

export type BinDealScannerEnvConfig = {
  webhookUrl: string | null;
  /** Uppercase SkyBlock item ids (e.g. HYPERION,VALKYRIE,SCYLLA,ASTRAEA). Empty = deal alerts disabled. */
  itemIds: Set<string>;
  minMarginCoins: number;
};

const COFL_AUCTION_BASE = "https://sky.coflnet.com/auction";

function isSupabaseMissingTableMessage(msg: string): boolean {
  return /could not find the table|PGRST205|schema cache/i.test(msg);
}

export function parseBinDealScannerEnv(): BinDealScannerEnvConfig {
  const webhookUrl = process.env.BIN_DEAL_ALERT_WEBHOOK_URL?.trim() || null;
  const rawIds = process.env.BIN_DEAL_ITEM_IDS?.trim();
  const itemIds = new Set(
    rawIds
      ? rawIds
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : []
  );
  const minRaw = process.env.BIN_DEAL_MIN_MARGIN_COINS?.trim();
  const minMarginCoins = Math.max(
    0,
    minRaw ? Number.parseInt(minRaw, 10) || 0 : 1_000_000
  );

  return { webhookUrl, itemIds, minMarginCoins };
}

export function binDealAlertsEnabled(cfg: BinDealScannerEnvConfig): boolean {
  return Boolean(cfg.webhookUrl && cfg.itemIds.size > 0);
}

/**
 * Wider allowlist + optional webhook override for `GET /api/track-bin-listings-wide`.
 * Webhook falls back to `BIN_DEAL_ALERT_WEBHOOK_URL` when `BIN_DEAL_WIDE_WEBHOOK_URL` is unset.
 * Margin falls back to `BIN_DEAL_MIN_MARGIN_COINS` when `BIN_DEAL_WIDE_MIN_MARGIN_COINS` is unset.
 */
export function parseWideBinDealScannerEnv(): BinDealScannerEnvConfig {
  const webhookUrl =
    process.env.BIN_DEAL_WIDE_WEBHOOK_URL?.trim() ||
    process.env.BIN_DEAL_ALERT_WEBHOOK_URL?.trim() ||
    null;
  const rawIds = process.env.BIN_DEAL_WIDE_ITEM_IDS?.trim();
  const itemIds = new Set(
    rawIds
      ? rawIds
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : []
  );
  const minRaw =
    process.env.BIN_DEAL_WIDE_MIN_MARGIN_COINS?.trim() ||
    process.env.BIN_DEAL_MIN_MARGIN_COINS?.trim();
  const minMarginCoins = Math.max(
    0,
    minRaw ? Number.parseInt(minRaw, 10) || 0 : 1_000_000
  );
  return { webhookUrl, itemIds, minMarginCoins };
}

export type BinDealRowInput = {
  auction_id: string;
  item_bytes: string | null;
  starting_bid: number;
  item_id: string | null;
  /** Hypixel `auctions[].start` (ms since epoch) — elapsed listing time in Discord. */
  auction_start_ms?: number;
};

export type BinDealAlertStats = {
  candidates: number;
  craftChecks: number;
  alertsSent: number;
  skippedAlreadyAlerted: number;
  skippedBelowMargin: number;
  skippedErrors: number;
  discordErrors: string[];
  /** Dedupe table missing — alerts sent without insert (possible repeats on reruns). */
  dedupeSkipped?: boolean;
};

/** Mutable dedupe flag shared across rows in one scan (missing table → skip insert). */
export type BinDealDedupeState = { dedupeSkipped: boolean };

/**
 * One BIN row: decode already done — craft + Discord as soon as allowlist matches.
 * Used by streaming scan (first pages) so pings are not delayed by the rest of the AH.
 *
 * `supabase === null` (`skipSupabase` on the route): still runs craft + Discord; skips dedupe insert/delete only.
 */
export async function processBinDealAlertForRow(
  supabase: SupabaseClient | null,
  row: BinDealRowInput,
  cfg: BinDealScannerEnvConfig,
  state: BinDealDedupeState,
  stats: BinDealAlertStats
): Promise<void> {
  if (!binDealAlertsEnabled(cfg)) return;

  const tag = row.item_id?.trim().toUpperCase();
  if (!tag || !cfg.itemIds.has(tag)) return;
  if (!row.item_bytes?.trim()) return;
  stats.candidates++;

  const startingBid = Math.floor(row.starting_bid);
  const webhookUrl = cfg.webhookUrl!;

  const breakdown = await computeAuctionBreakdownFromItemBytes(
    row.auction_id,
    row.item_bytes,
    { bazaarPriceMode: DEAL_ALERT_BAZAAR_MODE }
  );
  stats.craftChecks++;

  if (breakdown.error || breakdown.total <= 0) {
    stats.skippedErrors++;
    return;
  }

  const craft = breakdown.total;
  const margin = craft - startingBid;
  if (margin < cfg.minMarginCoins) {
    stats.skippedBelowMargin++;
    return;
  }

  if (supabase && !state.dedupeSkipped) {
    const { error: insErr } = await supabase
      .from("bin_deal_alert_sent")
      .insert({ auction_id: row.auction_id });

    if (insErr) {
      if (insErr.code === "23505") {
        stats.skippedAlreadyAlerted++;
        return;
      }
      if (isSupabaseMissingTableMessage(insErr.message)) {
        state.dedupeSkipped = true;
        stats.dedupeSkipped = true;
        stats.discordErrors.push(
          "bin_deal_alert_sent missing — run supabase/bin_deal_alert_sent.sql; sending without dedupe this run."
        );
      } else {
        stats.discordErrors.push(
          `bin_deal_alert_sent ${row.auction_id}: ${insErr.message}`
        );
        return;
      }
    }
  }

  const ok = await postBinDealDiscordEmbed(webhookUrl, {
    itemName: breakdown.auction.itemName,
    tag: breakdown.auction.tag,
    auctionId: row.auction_id,
    startingBid,
    craftCost: craft,
    margin,
    coflUrl: `${COFL_AUCTION_BASE}/${encodeURIComponent(row.auction_id)}`,
    craftPricingLabel: "Instant sell (sell_summary) — bazaar craft lines",
    listedForLabel: formatListedDuration(row.auction_start_ms),
  });

  if (!ok.ok) {
    stats.discordErrors.push(ok.error ?? "Discord POST failed");
    if (supabase) {
      await supabase
        .from("bin_deal_alert_sent")
        .delete()
        .eq("auction_id", row.auction_id);
    }
    return;
  }

  stats.alertsSent++;
}

export async function processBinDealAlerts(
  supabase: SupabaseClient,
  rows: BinDealRowInput[],
  cfg: BinDealScannerEnvConfig
): Promise<BinDealAlertStats> {
  const stats: BinDealAlertStats = {
    candidates: 0,
    craftChecks: 0,
    alertsSent: 0,
    skippedAlreadyAlerted: 0,
    skippedBelowMargin: 0,
    skippedErrors: 0,
    discordErrors: [],
  };

  if (!binDealAlertsEnabled(cfg)) return stats;

  const state: BinDealDedupeState = { dedupeSkipped: false };
  for (const row of rows) {
    await processBinDealAlertForRow(supabase, row, cfg, state, stats);
  }

  return stats;
}

/** Elapsed time since Hypixel auction `start` (when the listing went up). */
function formatListedDuration(
  auctionStartMs: number | undefined,
  nowMs = Date.now()
): string {
  if (auctionStartMs == null || !Number.isFinite(auctionStartMs)) {
    return "Unknown";
  }
  let sec = Math.floor((nowMs - auctionStartMs) / 1000);
  if (sec < 0) sec = 0;
  if (sec < 60) return "<1m";

  let d = Math.floor(sec / 86400);
  sec %= 86400;
  let h = Math.floor(sec / 3600);
  sec %= 3600;
  const m = Math.floor(sec / 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

async function postBinDealDiscordEmbed(
  webhookUrl: string,
  p: {
    itemName: string;
    tag: string;
    auctionId: string;
    startingBid: number;
    craftCost: number;
    margin: number;
    coflUrl: string;
    craftPricingLabel: string;
    listedForLabel: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const fmt = (n: number) =>
    `${n.toLocaleString("en-US")} coins`;

  const mentionRaw = process.env.BIN_DEAL_ALERT_MENTION_USER_ID?.trim();
  const mention =
    mentionRaw && /^\d{17,19}$/.test(mentionRaw)
      ? `<@${mentionRaw}>`
      : undefined;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(mention ? { content: mention } : {}),
        embeds: [
          {
            title: `BIN under craft: ${p.itemName}`,
            url: p.coflUrl,
            color: 0x22c55e,
            fields: [
              { name: "Tag", value: p.tag, inline: true },
              {
                name: "Craft pricing",
                value: p.craftPricingLabel,
                inline: false,
              },
              {
                name: "BIN",
                value: fmt(p.startingBid),
                inline: true,
              },
              {
                name: "Listed (since start)",
                value: p.listedForLabel,
                inline: true,
              },
              {
                name: "Craft (est.)",
                value: fmt(p.craftCost),
                inline: true,
              },
              {
                name: "Margin (craft − BIN)",
                value: fmt(p.margin),
                inline: false,
              },
              {
                name: "Auction UUID",
                value: `\`${p.auctionId}\``,
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Discord HTTP ${res.status} ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { reserveDealAlertMention } from "./bin-deal-mention-budget";
import {
  buildDealAlertControlComponents,
  buildDealAlertPauseEmbedLinkLine,
} from "./bin-deal-pause";
import { computeAuctionBreakdownFromItemBytes } from "./auction-breakdown";
import { decodeSkyblockItemBytes } from "./decode-item-bytes";
import { extraAttributesHasFatalTempo } from "./extra-enchantments";
import { isNecronsBladeItemId } from "./gemstone-slots";
import { getExtraAttributesFromFullNbt } from "./item-bytes-modifiers";
import { parseKuudraArmorTag } from "./kuudra-armor-crafting";
import { computeTerminatorCraftCost } from "./terminator-calculator";
import {
  DEFAULT_TERMINATOR_CRAFT_OPTIONS,
  type TerminatorCraftOptions,
} from "./terminator-options";

/** Deal Discord alerts always price craft with instant sell (`sell_summary`) — not buy-side. */
const DEAL_ALERT_BAZAAR_MODE = "instant_sell" as const;

export type BinDealScannerEnvConfig = {
  webhookUrl: string | null;
  /** Uppercase SkyBlock item ids (e.g. HYPERION,VALKYRIE,SCYLLA,ASTRAEA). Can be empty if Kuudra margin is set. */
  itemIds: Set<string>;
  /** Default minimum margin (craft − BIN) for items without a per-tag override. */
  minMarginCoins: number;
  /** Optional per-item minimum margins; overrides `minMarginCoins` for that SkyBlock id. */
  itemMarginByTag: Map<string, number>;
  /** Enable Kuudra armor scanning (CRIMSON/AURORA/FERVOR/TERROR/HOLLOW tags). */
  kuudraArmorEnabled: boolean;
};

const COFL_AUCTION_BASE = "https://sky.coflnet.com/auction";
const TERMINATOR_ITEM_ID = "TERMINATOR";

type TerminatorDealAlertGate = "ok" | "fatal_tempo" | "no_nbt";

async function terminatorDealAlertGate(
  row: Pick<BinDealRowInput, "item_id" | "item_bytes">
): Promise<TerminatorDealAlertGate> {
  const tag = row.item_id?.trim().toUpperCase() ?? "";
  if (tag !== TERMINATOR_ITEM_ID) return "ok";
  if (!row.item_bytes?.trim()) return "no_nbt";
  const decoded = await decodeSkyblockItemBytes(row.item_bytes);
  const extra = getExtraAttributesFromFullNbt(decoded.fullNbt);
  if (!extra) return "no_nbt";
  if (extraAttributesHasFatalTempo(extra)) return "fatal_tempo";
  return "ok";
}

/**
 * Terminator deal pings require decoded NBT and **no** Fatal Tempo / Ultimate Fatal Tempo.
 * (Base craft margin does not apply to those listings.)
 */
export async function terminatorRowPassesDealAlertItemGate(
  row: Pick<BinDealRowInput, "item_id" | "item_bytes">
): Promise<boolean> {
  return (await terminatorDealAlertGate(row)) === "ok";
}
/** Necron’s Blade line (HYPERION / VALKYRIE / SCYLLA / ASTRAEA): no ping if listing BIN is above this. */
const DEFAULT_NECRON_BLADE_ALERT_MAX_STARTING_BID = 2_000_000_000;
const TERMINATOR_CACHE_TTL_MS = 60_000;

function necronsBladeAlertMaxStartingBidCoins(): number {
  const raw =
    process.env.BIN_DEAL_NECRON_BLADE_ALERT_MAX_STARTING_BID?.trim() ||
    process.env.BIN_DEAL_HYPERION_ALERT_MAX_STARTING_BID?.trim();
  if (raw === "0") return Number.POSITIVE_INFINITY;
  if (!raw) return DEFAULT_NECRON_BLADE_ALERT_MAX_STARTING_BID;
  const n = Number.parseInt(raw.replace(/_/g, ""), 10);
  return Number.isFinite(n) && n > 0
    ? n
    : DEFAULT_NECRON_BLADE_ALERT_MAX_STARTING_BID;
}

const TERMINATOR_DEAL_BASE_OPTIONS: TerminatorCraftOptions = {
  ...DEFAULT_TERMINATOR_CRAFT_OPTIONS,
  // Deal scanner compares raw craft baseline, not listing-specific add-ons.
  hotPotatoBooksCount: 0,
  includeFumingPotatoBook: false,
  includeRecomb: false,
  includeArtOfWar: false,
};

let terminatorBaseCraftCache:
  | { value: number; expiresAt: number }
  | null = null;
let terminatorBaseCraftInFlight: Promise<number> | null = null;

function isSupabaseMissingTableMessage(msg: string): boolean {
  return /could not find the table|PGRST205|schema cache/i.test(msg);
}

async function getTerminatorBaseCraftCost(nowMs = Date.now()): Promise<number> {
  if (terminatorBaseCraftCache && terminatorBaseCraftCache.expiresAt > nowMs) {
    return terminatorBaseCraftCache.value;
  }
  if (terminatorBaseCraftInFlight) return terminatorBaseCraftInFlight;

  terminatorBaseCraftInFlight = computeTerminatorCraftCost(
    null,
    TERMINATOR_DEAL_BASE_OPTIONS
  )
    .then((r) => {
      const value = Math.max(0, Math.floor(r.total));
      terminatorBaseCraftCache = {
        value,
        expiresAt: Date.now() + TERMINATOR_CACHE_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      terminatorBaseCraftInFlight = null;
    });

  return terminatorBaseCraftInFlight;
}

/**
 * `BIN_DEAL_ITEM_MARGINS=TERMINATOR:30000000,HYPERION:1000000` — comma-separated TAG:coins pairs.
 */
function parseItemMarginByTag(raw: string | undefined): Map<string, number> {
  const m = new Map<string, number>();
  if (!raw?.trim()) return m;
  for (const segment of raw.split(",")) {
    const idx = segment.indexOf(":");
    if (idx <= 0) continue;
    const id = segment.slice(0, idx).trim().toUpperCase();
    const numPart = segment.slice(idx + 1).trim().replace(/_/g, "");
    const n = Number.parseInt(numPart, 10);
    if (id && Number.isFinite(n) && n >= 0) m.set(id, n);
  }
  return m;
}

function parseKuudraArmorEnabled(): boolean {
  const raw = process.env.BIN_DEAL_KUUDRA_ARMOR_MIN_MARGIN_COINS?.trim();
  if (!raw || raw === "0") return false;
  const n = Number.parseInt(raw.replace(/_/g, ""), 10);
  return Number.isFinite(n) && n > 0;
}

/**
 * Kuudra armor dynamic thresholds by BIN (starting bid):
 * <100M => 20M, 100-200M => 30M, 200-300M => 60M, 300-500M => 100M, 500M+ => 150M.
 */
function kuudraArmorMinMarginByStartingBid(startingBidCoins: number): number {
  if (startingBidCoins < 100_000_000) return 20_000_000;
  if (startingBidCoins < 200_000_000) return 30_000_000;
  if (startingBidCoins < 300_000_000) return 60_000_000;
  if (startingBidCoins < 500_000_000) return 100_000_000;
  return 150_000_000;
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
  const itemMarginByTag = parseItemMarginByTag(
    process.env.BIN_DEAL_ITEM_MARGINS?.trim()
  );
  const kuudraArmorEnabled = parseKuudraArmorEnabled();

  return {
    webhookUrl,
    itemIds,
    minMarginCoins,
    itemMarginByTag,
    kuudraArmorEnabled,
  };
}

/** True if this SkyBlock tag is covered by `BIN_DEAL_ITEM_IDS` or Kuudra armor env. */
export function isBinDealAlertTag(
  cfg: BinDealScannerEnvConfig,
  tag: string
): boolean {
  const t = tag.trim().toUpperCase();
  if (!t) return false;
  if (cfg.itemIds.has(t)) return true;
  return cfg.kuudraArmorEnabled && parseKuudraArmorTag(t) !== null;
}

export function binDealAlertsEnabled(cfg: BinDealScannerEnvConfig): boolean {
  return Boolean(
    cfg.webhookUrl &&
      (cfg.itemIds.size > 0 || cfg.kuudraArmorEnabled)
  );
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
  const itemMarginByTag = parseItemMarginByTag(
    process.env.BIN_DEAL_ITEM_MARGINS?.trim()
  );
  const kuudraArmorEnabled = parseKuudraArmorEnabled();
  return {
    webhookUrl,
    itemIds,
    minMarginCoins,
    itemMarginByTag,
    kuudraArmorEnabled,
  };
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
  /** Necron’s Blade line: starting bid above cap (default 2B). */
  skippedNecronBladeListingOverBinCap: number;
  /**
   * Terminator BIN skipped: NBT shows Fatal Tempo / Ultimate Fatal Tempo (not compared to base craft).
   */
  skippedTerminatorFatalTempo: number;
  /**
   * Terminator BIN skipped: missing `item_bytes` or unreadable ExtraAttributes (cannot verify no Fatal Tempo).
   */
  skippedTerminatorNoNbt: number;
  /** Allowlisted BIN rows skipped because deal alerts are paused (link from Discord). */
  skippedDealAlertsPaused: number;
  skippedErrors: number;
  discordErrors: string[];
  /** Dedupe table missing — alerts sent without insert (possible repeats on reruns). */
  dedupeSkipped?: boolean;
};

/** Mutable dedupe flag shared across rows in one scan (missing table → skip insert). */
export type BinDealDedupeState = { dedupeSkipped: boolean };

export type DealCraftForRowResult =
  | {
      ok: true;
      craft: number;
      itemName: string;
      tag: string;
      craftPricingLabel: string;
    }
  | { ok: false; error: string };

/**
 * Same craft math as deal alerts (Terminator base vs item_bytes breakdown).
 * Does not apply margin / Necron BIN cap / dedupe.
 */
export async function computeDealAlertCraftForRow(
  row: BinDealRowInput
): Promise<DealCraftForRowResult> {
  const tag = row.item_id?.trim().toUpperCase() ?? "";
  if (!tag) return { ok: false, error: "missing_item_id" };
  if (tag !== TERMINATOR_ITEM_ID && !row.item_bytes?.trim()) {
    return { ok: false, error: "missing_item_bytes" };
  }

  if (tag === TERMINATOR_ITEM_ID) {
    try {
      const craft = await getTerminatorBaseCraftCost();
      return {
        ok: true,
        craft,
        itemName: "Terminator",
        tag,
        craftPricingLabel:
          "Terminator base craft estimate (materials + Judgement Core), no listing add-ons",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  }

  const breakdown = await computeAuctionBreakdownFromItemBytes(
    row.auction_id,
    row.item_bytes,
    { bazaarPriceMode: DEAL_ALERT_BAZAAR_MODE }
  );
  if (breakdown.error || breakdown.total <= 0) {
    return {
      ok: false,
      error: breakdown.error ?? "invalid_craft_total",
    };
  }
  return {
    ok: true,
    craft: breakdown.total,
    itemName: breakdown.auction.itemName,
    tag: breakdown.auction.tag,
    craftPricingLabel: "Instant sell (sell_summary) — bazaar craft lines",
  };
}

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
  if (!tag || !isBinDealAlertTag(cfg, tag)) return;
  if (tag !== TERMINATOR_ITEM_ID && !row.item_bytes?.trim()) return;

  const startingBid = Math.floor(row.starting_bid);
  if (
    isNecronsBladeItemId(tag) &&
    startingBid > necronsBladeAlertMaxStartingBidCoins()
  ) {
    stats.skippedNecronBladeListingOverBinCap++;
    return;
  }

  if (tag === TERMINATOR_ITEM_ID) {
    const gate = await terminatorDealAlertGate(row);
    if (gate === "fatal_tempo") {
      stats.skippedTerminatorFatalTempo++;
      return;
    }
    if (gate === "no_nbt") {
      stats.skippedTerminatorNoNbt++;
      return;
    }
  }

  stats.candidates++;
  const webhookUrl = cfg.webhookUrl!;

  const craftResult = await computeDealAlertCraftForRow(row);
  if (!craftResult.ok) {
    stats.skippedErrors++;
    if (tag === TERMINATOR_ITEM_ID) {
      stats.discordErrors.push(
        `Terminator craft estimate failed: ${craftResult.error}`
      );
    }
    return;
  }
  stats.craftChecks++;
  const { craft, itemName, craftPricingLabel } = craftResult;

  const margin = craft - startingBid;
  const isKuudraDeal =
    cfg.kuudraArmorEnabled &&
    parseKuudraArmorTag(tag) !== null;
  const minNeed = isKuudraDeal
    ? kuudraArmorMinMarginByStartingBid(startingBid)
    : (cfg.itemMarginByTag.get(tag) ?? cfg.minMarginCoins);
  if (margin < minNeed) {
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

  const mention = await reserveDealAlertMention(supabase);
  try {
    const ok = await postBinDealDiscordEmbed(
      webhookUrl,
      {
        itemName,
        tag,
        auctionId: row.auction_id,
        startingBid,
        craftCost: craft,
        margin,
        coflUrl: `${COFL_AUCTION_BASE}/${encodeURIComponent(row.auction_id)}`,
        craftPricingLabel,
        listedForLabel: formatListedDuration(row.auction_start_ms),
      },
      { mentionContent: mention?.content }
    );

    if (!ok.ok) {
      await mention?.release();
      stats.discordErrors.push(ok.error ?? "Discord POST failed");
      if (supabase) {
        await supabase
          .from("bin_deal_alert_sent")
          .delete()
          .eq("auction_id", row.auction_id);
      }
      return;
    }
  } catch (e) {
    await mention?.release();
    throw e;
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
    skippedNecronBladeListingOverBinCap: 0,
    skippedTerminatorFatalTempo: 0,
    skippedTerminatorNoNbt: 0,
    skippedDealAlertsPaused: 0,
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
export function formatListedDuration(
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
  },
  opts?: { mentionContent?: string }
): Promise<{ ok: boolean; error?: string }> {
  const fmt = (n: number) =>
    `${n.toLocaleString("en-US")} coins`;

  const mention = opts?.mentionContent?.trim() || undefined;

  const components = buildDealAlertControlComponents();
  const pauseEmbedLine =
    !components ? buildDealAlertPauseEmbedLinkLine() : null;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(mention ? { content: mention } : {}),
        ...(components ? { components } : {}),
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
              ...(pauseEmbedLine
                ? [
                    {
                      name: "Pause / resume",
                      value: pauseEmbedLine,
                      inline: false,
                    },
                  ]
                : []),
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

/** Hourly test ping — same numbers as real alerts, embed marked TEST (amber). */
export async function postBinDealTestPingEmbed(
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
  },
  opts?: { mentionContent?: string }
): Promise<{ ok: boolean; error?: string }> {
  const fmt = (n: number) =>
    `${n.toLocaleString("en-US")} coins`;

  const mention = opts?.mentionContent?.trim() || undefined;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(mention ? { content: mention } : {}),
        embeds: [
          {
            title: `🧪 TEST: craft check — ${p.itemName}`,
            url: p.coflUrl,
            color: 0xf59e0b,
            description:
              "Scheduled test ping. Margin can be negative; this is **not** a deal alert.",
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

import { NextResponse } from "next/server";
import { computeTerminatorCraftCost } from "@/lib/terminator-calculator";
import { requiredSellPrice } from "@/lib/calculator";
import { HOT_POTATO_BOOKS_COUNT } from "@/lib/calculator-options";
import {
  DEFAULT_TERMINATOR_CRAFT_OPTIONS,
  type TerminatorPartPricing,
  type TerminatorCraftOptions,
} from "@/lib/terminator-options";

export const dynamic = "force-dynamic";

function parseJudgementOverrideCoins(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  return null;
}

function parsePartPricing(
  v: unknown,
  fallback: TerminatorPartPricing
): TerminatorPartPricing {
  if (v === "bazaar" || v === "craft") return v;
  return fallback;
}

function parseTier(v: unknown, fallback: number, max: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(max, Math.max(0, Math.floor(v)));
  }
  return fallback;
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as Record<string, unknown>;
    const judgementOverrideCoins = parseJudgementOverrideCoins(
      json.judgementOverrideCoins
    );
    const desiredProfit =
      typeof json.desiredProfit === "number" && Number.isFinite(json.desiredProfit)
        ? Math.max(0, Math.floor(json.desiredProfit))
        : 35_000_000;

    const d = DEFAULT_TERMINATOR_CRAFT_OPTIONS;

    const pricing: TerminatorCraftOptions = {
      braidedPricing: parsePartPricing(json.braidedPricing, d.braidedPricing),
      nullBladePricing: parsePartPricing(json.nullBladePricing, d.nullBladePricing),
      tierDuplex: parseTier(json.tierDuplex, d.tierDuplex, 5),
      tierSoulEater: parseTier(json.tierSoulEater, d.tierSoulEater, 5),
      tierToxophilite: parseTier(json.tierToxophilite, d.tierToxophilite, 10),
      tierChance: parseTier(json.tierChance, d.tierChance, 5),
      tierCubism: parseTier(json.tierCubism, d.tierCubism, 6),
      tierFlame: parseTier(json.tierFlame, d.tierFlame, 2),
      tierImpaling: parseTier(json.tierImpaling, d.tierImpaling, 3),
      tierInfiniteQuiver: parseTier(
        json.tierInfiniteQuiver,
        d.tierInfiniteQuiver,
        10
      ),
      tierOverload: parseTier(json.tierOverload, d.tierOverload, 5),
      tierPiercing: parseTier(json.tierPiercing, d.tierPiercing, 1),
      tierPower: parseTier(json.tierPower, d.tierPower, 7),
      tierSnipe: parseTier(json.tierSnipe, d.tierSnipe, 4),
      hotPotatoBooksCount: parseTier(
        json.hotPotatoBooksCount,
        d.hotPotatoBooksCount,
        HOT_POTATO_BOOKS_COUNT
      ),
      includeFumingPotatoBook: parseBool(
        json.includeFumingPotatoBook,
        d.includeFumingPotatoBook
      ),
      includeRecomb: parseBool(json.includeRecomb, d.includeRecomb),
      includeArtOfWar: parseBool(json.includeArtOfWar, d.includeArtOfWar),
    };

    const { sections, total, judgementLowestBin, judgementAutoCoins } =
      await computeTerminatorCraftCost(judgementOverrideCoins, pricing);
    const sellPrice = requiredSellPrice(total, desiredProfit);

    return NextResponse.json({
      sections,
      totalCraftCost: total,
      desiredProfit,
      auctionTaxRate: 0.035,
      requiredSellPrice: Math.ceil(sellPrice),
      judgementLowestBin,
      judgementAutoCoins,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

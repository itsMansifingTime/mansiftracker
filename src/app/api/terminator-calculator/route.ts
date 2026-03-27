import { NextResponse } from "next/server";
import {
  computeTerminatorCraftCost,
} from "@/lib/terminator-calculator";
import { requiredSellPrice } from "@/lib/calculator";
import {
  DEFAULT_TERMINATOR_CRAFT_OPTIONS,
  type TerminatorPartPricing,
} from "@/lib/terminator-options";

export const dynamic = "force-dynamic";

function parseJudgementOverrideCoins(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  return null;
}

function parsePartPricing(v: unknown, fallback: TerminatorPartPricing): TerminatorPartPricing {
  if (v === "bazaar" || v === "craft") return v;
  return fallback;
}

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as {
      desiredProfit?: number;
      judgementOverrideCoins?: unknown;
      braidedPricing?: unknown;
      nullBladePricing?: unknown;
    };
    const judgementOverrideCoins = parseJudgementOverrideCoins(
      json.judgementOverrideCoins
    );
    const desiredProfit =
      typeof json.desiredProfit === "number" && Number.isFinite(json.desiredProfit)
        ? Math.max(0, Math.floor(json.desiredProfit))
        : 35_000_000;

    const d = DEFAULT_TERMINATOR_CRAFT_OPTIONS;
    const pricing = {
      braidedPricing: parsePartPricing(json.braidedPricing, d.braidedPricing),
      nullBladePricing: parsePartPricing(json.nullBladePricing, d.nullBladePricing),
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

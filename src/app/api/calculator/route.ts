import { NextResponse } from "next/server";
import {
  computeCraftCost,
  requiredSellPrice,
} from "@/lib/calculator";
import {
  DEFAULT_CALCULATOR_OPTIONS,
  ENCHANT_DROPDOWNS,
  type CalculatorOptions,
  type GemSapphire,
} from "@/lib/calculator-options";

export const dynamic = "force-dynamic";

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

function parseIntClamped(
  v: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function parseTier(
  v: unknown,
  fallback: number,
  allowed: readonly number[]
): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return allowed.includes(n) ? n : fallback;
}

function parseGemSapphire(v: unknown, fallback: GemSapphire): GemSapphire {
  if (v === "none" || v === "flawless" || v === "perfect") return v;
  return fallback;
}

function parseHandleOverrideCoins(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  return null;
}

function bodyToOptions(
  body: Record<string, unknown> | null
): CalculatorOptions {
  const b = body?.options as Record<string, unknown> | undefined;
  const d = DEFAULT_CALCULATOR_OPTIONS;
  if (!b) return d;

  const tiers: Pick<
    CalculatorOptions,
    | "tierUltimateWise"
    | "tierVampirism"
    | "tierSharpness"
    | "tierExperience"
    | "tierGiantKiller"
    | "tierEnderSlayer"
    | "tierVenomous"
  > = {
    tierUltimateWise: d.tierUltimateWise,
    tierVampirism: d.tierVampirism,
    tierSharpness: d.tierSharpness,
    tierExperience: d.tierExperience,
    tierGiantKiller: d.tierGiantKiller,
    tierEnderSlayer: d.tierEnderSlayer,
    tierVenomous: d.tierVenomous,
  };

  for (const row of ENCHANT_DROPDOWNS) {
    const allowed = row.options.map((o) => o.value);
    let v: number;
    switch (row.key) {
      case "tierUltimateWise":
        v = parseTier(b.tierUltimateWise, d.tierUltimateWise, allowed);
        tiers.tierUltimateWise = v;
        break;
      case "tierVampirism":
        v = parseTier(b.tierVampirism, d.tierVampirism, allowed);
        tiers.tierVampirism = v;
        break;
      case "tierSharpness":
        v = parseTier(b.tierSharpness, d.tierSharpness, allowed);
        tiers.tierSharpness = v;
        break;
      case "tierExperience":
        v = parseTier(b.tierExperience, d.tierExperience, allowed);
        tiers.tierExperience = v;
        break;
      case "tierGiantKiller":
        v = parseTier(b.tierGiantKiller, d.tierGiantKiller, allowed);
        tiers.tierGiantKiller = v;
        break;
      case "tierEnderSlayer":
        v = parseTier(b.tierEnderSlayer, d.tierEnderSlayer, allowed);
        tiers.tierEnderSlayer = v;
        break;
      case "tierVenomous":
        v = parseTier(b.tierVenomous, d.tierVenomous, allowed);
        tiers.tierVenomous = v;
        break;
      default:
        break;
    }
  }

  return {
    starCount: parseIntClamped(b.starCount, d.starCount, 0, 10),
    includeFumingPotatoBook: parseBool(
      b.includeFumingPotatoBook,
      d.includeFumingPotatoBook
    ),
    includeTitanics: parseBool(b.includeTitanics, d.includeTitanics),
    includeRecomb: parseBool(b.includeRecomb, d.includeRecomb),
    ...tiers,
    gemSlotsUnlocked: parseBool(b.gemSlotsUnlocked, d.gemSlotsUnlocked),
    gemSapphire: parseGemSapphire(b.gemSapphire, d.gemSapphire),
    includeWitherShield: parseBool(b.includeWitherShield, d.includeWitherShield),
    includeShadowWarp: parseBool(b.includeShadowWarp, d.includeShadowWarp),
    includeImplosion: parseBool(b.includeImplosion, d.includeImplosion),
  };
}

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as {
      options?: Record<string, unknown>;
      desiredProfit?: number;
      handleOverrideCoins?: unknown;
    };
    const options = bodyToOptions({ options: json.options ?? null });
    const handleOverrideCoins = parseHandleOverrideCoins(
      json.handleOverrideCoins
    );
    const desiredProfit =
      typeof json.desiredProfit === "number" && Number.isFinite(json.desiredProfit)
        ? Math.max(0, Math.floor(json.desiredProfit))
        : 35_000_000;

    const { sections, total, necronLowestBin, handleAutoCoins } =
      await computeCraftCost(options, handleOverrideCoins);
    const sellPrice = requiredSellPrice(total, desiredProfit);

    return NextResponse.json({
      sections,
      totalCraftCost: total,
      desiredProfit,
      auctionTaxRate: 0.035,
      requiredSellPrice: Math.ceil(sellPrice),
      necronLowestBin,
      handleAutoCoins,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

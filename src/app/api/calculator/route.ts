import { NextResponse } from "next/server";
import {
  computeCraftCost,
  requiredSellPrice,
} from "@/lib/calculator";
import {
  DEFAULT_CALCULATOR_OPTIONS,
  type CalculatorOptions,
} from "@/lib/calculator-options";

export const dynamic = "force-dynamic";

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

function bodyToOptions(
  body: Record<string, unknown> | null
): CalculatorOptions {
  const b = body?.options as Record<string, unknown> | undefined;
  const d = DEFAULT_CALCULATOR_OPTIONS;
  if (!b) return d;
  return {
    includeUltimateWise: parseBool(b.includeUltimateWise, d.includeUltimateWise),
    includeVampirism: parseBool(b.includeVampirism, d.includeVampirism),
    includeSharpness: parseBool(b.includeSharpness, d.includeSharpness),
    includeExperience: parseBool(b.includeExperience, d.includeExperience),
    includeGiantKiller: parseBool(b.includeGiantKiller, d.includeGiantKiller),
    includeEnderSlayer: parseBool(b.includeEnderSlayer, d.includeEnderSlayer),
    includeVenomous: parseBool(b.includeVenomous, d.includeVenomous),
    gemsUnlocked: parseBool(b.gemsUnlocked, d.gemsUnlocked),
    useFlawlessSapphire: parseBool(b.useFlawlessSapphire, d.useFlawlessSapphire),
    usePerfectSapphire: parseBool(b.usePerfectSapphire, d.usePerfectSapphire),
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
    };
    const options = bodyToOptions({ options: json.options ?? null });
    const desiredProfit =
      typeof json.desiredProfit === "number" && Number.isFinite(json.desiredProfit)
        ? Math.max(0, Math.floor(json.desiredProfit))
        : 50_000_000;

    const { lines, total } = await computeCraftCost(options);
    const sellPrice = requiredSellPrice(total, desiredProfit);

    return NextResponse.json({
      lines,
      totalCraftCost: total,
      desiredProfit,
      auctionTaxRate: 0.035,
      requiredSellPrice: Math.ceil(sellPrice),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

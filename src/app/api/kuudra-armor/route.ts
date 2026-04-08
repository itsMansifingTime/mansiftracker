import { NextResponse } from "next/server";
import {
  bazaarInstantSell,
  fetchBazaar,
  getProduct,
} from "@/lib/bazaar";
import {
  getKuudraArmorCraftSteps,
  KUUDRA_CRAFT_BAZAAR,
  sumKuudraCraftSteps,
  type KuudraEndTier,
} from "@/lib/kuudra-armor-crafting";

export const dynamic = "force-dynamic";

const TIERS: KuudraEndTier[] = ["hot", "burning", "fiery", "infernal"];

function parseEndTier(raw: string | null): KuudraEndTier | null {
  if (!raw) return null;
  return TIERS.includes(raw as KuudraEndTier) ? (raw as KuudraEndTier) : null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const endTier = parseEndTier(url.searchParams.get("endTier"));
    if (!endTier) {
      return NextResponse.json(
        { error: "Query endTier=hot|burning|fiery|infernal is required" },
        { status: 400 }
      );
    }
    const infernalStarsRaw = url.searchParams.get("infernalStars");
    let infernalStars: number | undefined;
    if (infernalStarsRaw !== null && infernalStarsRaw !== "") {
      const n = Number.parseInt(infernalStarsRaw, 10);
      if (Number.isFinite(n)) infernalStars = n;
    }

    const steps = getKuudraArmorCraftSteps({
      endTier,
      infernalStars,
    });
    const mats = sumKuudraCraftSteps(steps);

    const bazaar = await fetchBazaar();
    const products = bazaar.products;
    const unit = (id: string) =>
      bazaarInstantSell(getProduct(products, id));

    const essenceUnit = unit(KUUDRA_CRAFT_BAZAAR.essence);
    const pearlUnit = unit(KUUDRA_CRAFT_BAZAAR.heavyPearl);
    const teethUnit = unit(KUUDRA_CRAFT_BAZAAR.kuudraTeeth);

    const bazaarCoins =
      essenceUnit * mats.essence +
      pearlUnit * mats.heavyPearls +
      teethUnit * mats.kuudraTeeth;

    const totalCoins = bazaarCoins + mats.blacksmithCoins;

    const infernalApplied = steps.filter((s) =>
      s.label.startsWith("Infernal")
    ).length;

    return NextResponse.json({
      endTier,
      infernalStars: endTier === "infernal" ? infernalApplied : 0,
      steps,
      materials: mats,
      bazaar: {
        essencePerUnit: essenceUnit,
        heavyPearlPerUnit: pearlUnit,
        kuudraTeethPerUnit: teethUnit,
        subtotal: Math.round(bazaarCoins),
      },
      blacksmithCoins: mats.blacksmithCoins,
      totalCraftCoins: Math.round(totalCoins),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

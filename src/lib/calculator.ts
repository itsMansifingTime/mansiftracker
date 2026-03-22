import { bazaarInstantSell, fetchBazaar, getProduct } from "./bazaar";
import type { CalculatorOptions } from "./calculator-options";
import { fetchLowestNecronBin } from "./coflnet";

export type { CalculatorOptions } from "./calculator-options";
export {
  DEFAULT_CALCULATOR_OPTIONS,
  TRACKER_SNAPSHOT_OPTIONS,
} from "./calculator-options";

export type CostLine = { label: string; cost: number };

const ENCHANTS: { key: keyof CalculatorOptions; id: string; label: string }[] =
  [
    {
      key: "includeUltimateWise",
      id: "ENCHANTMENT_ULTIMATE_WISE_5",
      label: "Ultimate Wise V",
    },
    {
      key: "includeVampirism",
      id: "ENCHANTMENT_VAMPIRISM_6",
      label: "Vampirism VI",
    },
    {
      key: "includeSharpness",
      id: "ENCHANTMENT_SHARPNESS_6",
      label: "Sharpness VI",
    },
    {
      key: "includeExperience",
      id: "ENCHANTMENT_EXPERIENCE_4",
      label: "Experience IV",
    },
    {
      key: "includeGiantKiller",
      id: "ENCHANTMENT_GIANT_KILLER_6",
      label: "Giant Killer VI",
    },
    {
      key: "includeEnderSlayer",
      id: "ENCHANTMENT_ENDER_SLAYER_6",
      label: "Ender Slayer VI",
    },
    {
      key: "includeVenomous",
      id: "ENCHANTMENT_VENOMOUS_6",
      label: "Venomous VI",
    },
  ];

const SAPPHIRE_SLOTS = 3;

export async function computeCraftCost(
  options: CalculatorOptions
): Promise<{ lines: CostLine[]; total: number }> {
  const [bazaar, necronBin] = await Promise.all([
    fetchBazaar(),
    fetchLowestNecronBin(),
  ]);

  const products = bazaar.products;
  const lines: CostLine[] = [];

  lines.push({
    label: "Necron's Handle (lowest BIN)",
    cost: necronBin,
  });

  const wither = bazaarInstantSell(getProduct(products, "WITHER_CATALYST"));
  lines.push({
    label: "Wither Catalyst (bazaar instant sell)",
    cost: wither,
  });

  const lasr = bazaarInstantSell(getProduct(products, "GIANT_FRAGMENT_LASER"));
  lines.push({
    label: "L.A.S.R.'s Eye (GIANT_FRAGMENT_LASER, instant sell)",
    cost: lasr,
  });

  for (const e of ENCHANTS) {
    if (!options[e.key]) continue;
    const p = getProduct(products, e.id);
    lines.push({
      label: `${e.label} (${e.id})`,
      cost: bazaarInstantSell(p),
    });
  }

  if (options.gemsUnlocked) {
    if (options.usePerfectSapphire) {
      const gem = bazaarInstantSell(getProduct(products, "PERFECT_SAPPHIRE_GEM"));
      lines.push({
        label: `Perfect Sapphire ×${SAPPHIRE_SLOTS}`,
        cost: gem * SAPPHIRE_SLOTS,
      });
    } else if (options.useFlawlessSapphire) {
      const gem = bazaarInstantSell(
        getProduct(products, "FLAWLESS_SAPPHIRE_GEM")
      );
      lines.push({
        label: `Flawless Sapphire ×${SAPPHIRE_SLOTS}`,
        cost: gem * SAPPHIRE_SLOTS,
      });
    }
  }

  if (options.includeWitherShield) {
    lines.push({
      label: "Wither Shield (scroll)",
      cost: bazaarInstantSell(getProduct(products, "WITHER_SHIELD_SCROLL")),
    });
  }
  if (options.includeShadowWarp) {
    lines.push({
      label: "Shadow Warp (scroll)",
      cost: bazaarInstantSell(getProduct(products, "SHADOW_WARP_SCROLL")),
    });
  }
  if (options.includeImplosion) {
    lines.push({
      label: "Implosion (scroll)",
      cost: bazaarInstantSell(getProduct(products, "IMPLOSION_SCROLL")),
    });
  }

  const total = lines.reduce((s, l) => s + l.cost, 0);
  return { lines, total };
}

export const AUCTION_TAX = 0.035;

export function requiredSellPrice(
  craftCost: number,
  desiredProfit: number,
  taxRate = AUCTION_TAX
): number {
  return (craftCost + desiredProfit) / (1 - taxRate);
}

import {
  bazaarBuyOrderPrice,
  bazaarInstantSell,
  bazaarSellSummaryFirst,
  fetchBazaar,
  getProduct,
} from "./bazaar";
import {
  ENCHANT_DROPDOWNS,
  FIXED_ENCHANTS,
  HANDLE_DEFAULT_PCT_UNDER_BIN,
  HOT_POTATO_BOOKS_COUNT,
  SOCKETED_SAPPHIRE_COUNT,
  type CalculatorOptions,
} from "./calculator-options";
import { getEnchantCost } from "./enchant-pricing";
import { cumulativeRegularStarCosts } from "./hyperion-stars";
import { fetchLowestNecronBin } from "./coflnet";
import {
  HYPERION_SLOT_UNLOCK_RECIPES,
  hyperionSlotUnlockCost,
} from "./gemstone-slots";

export type { CalculatorOptions } from "./calculator-options";
export {
  DEFAULT_CALCULATOR_OPTIONS,
  ENCHANT_DROPDOWNS,
  TRACKER_SNAPSHOT_OPTIONS,
} from "./calculator-options";

export type CostLine = { label: string; cost: number };

export type CostSection = {
  id: string;
  title: string;
  lines: CostLine[];
  subtotalLabel: string;
  subtotal: number;
};

const MASTER_STAR_IDS = [
  "FIRST_MASTER_STAR",
  "SECOND_MASTER_STAR",
  "THIRD_MASTER_STAR",
  "FOURTH_MASTER_STAR",
  "FIFTH_MASTER_STAR",
] as const;

const WITHER_CATALYST_COUNT = 24;
const LASR_EYE_COUNT = 8;

function sumSection(lines: CostLine[]): number {
  return lines.reduce((s, l) => s + l.cost, 0);
}

function tierLabel(
  row: (typeof ENCHANT_DROPDOWNS)[number],
  tier: number
): string {
  const opt = row.options.find((o) => o.value === tier);
  return opt ? `${row.label} ${opt.label === "None" ? "" : opt.label}`.trim() : row.label;
}

export type ComputeCraftCostResult = {
  sections: CostSection[];
  total: number;
  necronLowestBin: number;
  handleAutoCoins: number;
};

/**
 * @param handleOverrideCoins — if non-null, used as handle line cost; otherwise
 *   lowest BIN × (1 − {@link HANDLE_DEFAULT_PCT_UNDER_BIN}%).
 */
export async function computeCraftCost(
  options: CalculatorOptions,
  handleOverrideCoins: number | null = null
): Promise<ComputeCraftCostResult> {
  const [bazaar, necronBin] = await Promise.all([
    fetchBazaar(),
    fetchLowestNecronBin(),
  ]);

  const products = bazaar.products;
  const sections: CostSection[] = [];

  const handleAutoCoins = Math.round(
    necronBin * (1 - HANDLE_DEFAULT_PCT_UNDER_BIN / 100)
  );
  const useOverride =
    handleOverrideCoins !== null && Number.isFinite(handleOverrideCoins);
  const handleCost = useOverride
    ? Math.max(0, Math.round(handleOverrideCoins as number))
    : handleAutoCoins;
  const handleLabel = useOverride
    ? "Handle (custom)"
    : `Handle (${HANDLE_DEFAULT_PCT_UNDER_BIN}% under lowest BIN)`;

  // --- Hyperion Craft Cost ---
  const hyperionLines: CostLine[] = [
    { label: handleLabel, cost: handleCost },
    {
      label: "Wither Catalyst",
      cost:
        bazaarInstantSell(getProduct(products, "WITHER_CATALYST")) *
        WITHER_CATALYST_COUNT,
    },
    {
      label: "L.A.S.R Eye",
      cost:
        bazaarInstantSell(getProduct(products, "GIANT_FRAGMENT_LASER")) *
        LASR_EYE_COUNT,
    },
  ];

  const hotPotatoUnit = bazaarInstantSell(
    getProduct(products, "HOT_POTATO_BOOK")
  );
  hyperionLines.push({
    label: `Hot Potato Book (×${HOT_POTATO_BOOKS_COUNT})`,
    cost: hotPotatoUnit * HOT_POTATO_BOOKS_COUNT,
  });
  if (options.includeFumingPotatoBook) {
    hyperionLines.push({
      label: "Fuming Potato Book",
      cost: bazaarInstantSell(getProduct(products, "FUMING_POTATO_BOOK")),
    });
  }
  sections.push({
    id: "hyperion",
    title: "Hyperion Craft Cost",
    lines: hyperionLines,
    subtotalLabel: "Total Hyperion Craft Cost",
    subtotal: sumSection(hyperionLines),
  });

  // --- Enchanted ---
  const enchantLines: CostLine[] = [];

  const slider = Math.min(Math.max(Math.floor(options.starCount), 0), 10);
  /** 0–5: regular gold ★ (Wither Essence). 6–10: always 5 regular + (slider−5) master ★. */
  const regularCount = Math.min(slider, 5);
  const masterCount = Math.min(Math.max(slider - 5, 0), MASTER_STAR_IDS.length);

  const witherProduct = getProduct(products, "ESSENCE_WITHER");
  /** Wither essence: sell_summary[0] = instant sell (lower; Hyperion calculator only). */
  const witherPerUnit = bazaarSellSummaryFirst(witherProduct);
  const { essence: essenceTotal, coins: starCoins } =
    cumulativeRegularStarCosts(regularCount);
  const regularStarsCost =
    Math.round(witherPerUnit * essenceTotal) + starCoins;

  let masterStarsCost = 0;
  for (let i = 0; i < masterCount; i++) {
    masterStarsCost += bazaarInstantSell(
      getProduct(products, MASTER_STAR_IDS[i])
    );
  }

  const starsTotalCost = regularStarsCost + masterStarsCost;
  const starsLabel =
    slider === 0
      ? "Stars (0/10, off)"
      : slider <= 5
        ? `Stars (${slider}/10, regular)`
        : `Stars (${slider}/10, 5 regular + ${masterCount} master)`;

  enchantLines.push({
    label: starsLabel,
    cost: starsTotalCost,
  });

  if (options.includeTitanics) {
    enchantLines.push({
      label: "Titanics",
      cost: bazaarInstantSell(getProduct(products, "TITANIC_EXP_BOTTLE")),
    });
  }

  if (options.includeRecomb) {
    enchantLines.push({
      label: "Recomb",
      cost: bazaarInstantSell(getProduct(products, "RECOMBOBULATOR_3000")),
    });
  }

  if (options.includeArtOfWar) {
    enchantLines.push({
      label: "The Art of War",
      cost: bazaarInstantSell(getProduct(products, "THE_ART_OF_WAR")),
    });
  }

  let baseEnchantsCost = 0;
  for (const e of FIXED_ENCHANTS) {
    baseEnchantsCost += getEnchantCost(
      e.prefix,
      e.tier,
      products,
      bazaarInstantSell
    );
  }
  enchantLines.push({ label: "Enchants (BASE)", cost: baseEnchantsCost });

  for (const row of ENCHANT_DROPDOWNS) {
    const tier = options[row.key] as number;
    const cost = getEnchantCost(
      row.prefix,
      tier,
      products,
      bazaarInstantSell
    );
    enchantLines.push({
      label: tierLabel(row, tier),
      cost,
    });
  }

  sections.push({
    id: "enchanted",
    title: "Enchanted Hyperion Craft Cost",
    lines: enchantLines,
    subtotalLabel: "Total Enchanted Hyperion Craft Cost",
    subtotal: sumSection(enchantLines),
  });

  // --- Gemmed ---
  const slotsOn = options.gemSlotsUnlocked;
  const flawlessCost =
    slotsOn && options.gemSapphire === "flawless"
      ? bazaarInstantSell(getProduct(products, "FLAWLESS_SAPPHIRE_GEM")) *
        SOCKETED_SAPPHIRE_COUNT
      : 0;
  const perfectCost =
    slotsOn && options.gemSapphire === "perfect"
      ? bazaarInstantSell(getProduct(products, "PERFECT_SAPPHIRE_GEM")) *
        SOCKETED_SAPPHIRE_COUNT
      : 0;

  const gemLines: CostLine[] = [
    {
      label: HYPERION_SLOT_UNLOCK_RECIPES[0].label,
      cost: slotsOn
        ? hyperionSlotUnlockCost(
            HYPERION_SLOT_UNLOCK_RECIPES[0],
            products,
            bazaarInstantSell
          )
        : 0,
    },
    {
      label: HYPERION_SLOT_UNLOCK_RECIPES[1].label,
      cost: slotsOn
        ? hyperionSlotUnlockCost(
            HYPERION_SLOT_UNLOCK_RECIPES[1],
            products,
            bazaarInstantSell
          )
        : 0,
    },
    ...(slotsOn
      ? [
          { label: "Flawless", cost: flawlessCost },
          { label: "Perfect", cost: perfectCost },
        ]
      : []),
  ];

  sections.push({
    id: "gemmed",
    title: "Gemmed Hyperion Craft Cost",
    lines: gemLines,
    subtotalLabel: "Total Gemmed Hyperion Craft Cost",
    subtotal: sumSection(gemLines),
  });

  // --- WIMP (buy-order when “instant buy” — matches breakdown / enchant books) ---
  const scrollPrice = options.scrollsInstantBuy
    ? bazaarBuyOrderPrice
    : bazaarSellSummaryFirst;
  const wimpLines: CostLine[] = [];
  if (options.includeWitherShield) {
    wimpLines.push({
      label: "Wither Shield",
      cost: scrollPrice(getProduct(products, "WITHER_SHIELD_SCROLL")),
    });
  }
  if (options.includeShadowWarp) {
    wimpLines.push({
      label: "Shadow Warp",
      cost: scrollPrice(getProduct(products, "SHADOW_WARP_SCROLL")),
    });
  }
  if (options.includeImplosion) {
    wimpLines.push({
      label: "Implosion",
      cost: scrollPrice(getProduct(products, "IMPLOSION_SCROLL")),
    });
  }

  sections.push({
    id: "wimp",
    title: "WIMP Hyperion Craft Cost",
    lines: wimpLines,
    subtotalLabel: "Total WIMP Hyperion Craft Cost",
    subtotal: sumSection(wimpLines),
  });

  const total = sections.reduce((s, sec) => s + sec.subtotal, 0);
  return { sections, total, necronLowestBin: necronBin, handleAutoCoins };
}

export const AUCTION_TAX = 0.035;

export function requiredSellPrice(
  craftCost: number,
  desiredProfit: number,
  taxRate = AUCTION_TAX
): number {
  return (craftCost + desiredProfit) / (1 - taxRate);
}

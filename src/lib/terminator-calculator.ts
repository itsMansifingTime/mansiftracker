import { bazaarInstantSell, fetchBazaar, getProduct } from "./bazaar";
import { HANDLE_DEFAULT_PCT_UNDER_BIN } from "./calculator-options";
import { fetchLowestJudgementBin } from "./coflnet";
import {
  DEFAULT_TERMINATOR_CRAFT_OPTIONS,
  type TerminatorCraftOptions,
} from "./terminator-options";
import type { CostLine, CostSection } from "./calculator";

export type { CostLine, CostSection } from "./calculator";
export type { TerminatorCraftOptions, TerminatorPartPricing } from "./terminator-options";
export { DEFAULT_TERMINATOR_CRAFT_OPTIONS } from "./terminator-options";

/** Wiki: 128 Tarantula Silk, 8 Tessellated Ender Pearls, 4 Braided Griffin Feathers, 3 Null Blades, 1 Judgement Core. */
const TARANTULA_SILK_COUNT = 128;
const TESSELLATED_ENDER_PEARL_COUNT = 8;
const BRAIDED_GRIFFIN_FEATHER_COUNT = 4;
/** Per braided: 160 Griffin Feather + 256 Soul String (wiki). */
const GRIFFIN_FEATHER_PER_BRAIDED = 160;
const SOUL_STRING_PER_BRAIDED = 256;
const NULL_BLADE_COUNT = 3;
/** Per Null Blade: 64 Null Ovoid + 64 Enchanted Quartz Block + 3 Null Edge (wiki). */
const NULL_OVOID_PER_BLADE = 64;
const ENCHANTED_QUARTZ_BLOCK_PER_BLADE = 64;
const NULL_EDGE_PER_BLADE = 3;

function sumSection(lines: CostLine[]): number {
  return lines.reduce((s, l) => s + l.cost, 0);
}

export type ComputeTerminatorCraftCostResult = {
  sections: CostSection[];
  total: number;
  judgementLowestBin: number;
  judgementAutoCoins: number;
};

/**
 * Terminator bow craft (Enderman Slayer 7). Judgement Core: CoflNet lowest BIN
 * or override. Braided / Null Blade: bazaar or craft (see options).
 */
export async function computeTerminatorCraftCost(
  judgementOverrideCoins: number | null = null,
  options: TerminatorCraftOptions = DEFAULT_TERMINATOR_CRAFT_OPTIONS
): Promise<ComputeTerminatorCraftCostResult> {
  const [bazaar, judgementBin] = await Promise.all([
    fetchBazaar(),
    fetchLowestJudgementBin(),
  ]);

  const products = bazaar.products;

  const judgementAutoCoins = Math.round(
    judgementBin * (1 - HANDLE_DEFAULT_PCT_UNDER_BIN / 100)
  );
  const useOverride =
    judgementOverrideCoins !== null && Number.isFinite(judgementOverrideCoins);
  const judgementCost = useOverride
    ? Math.max(0, Math.round(judgementOverrideCoins as number))
    : judgementAutoCoins;
  const judgementLabel = useOverride
    ? "Judgement Core (custom)"
    : `Judgement Core (${HANDLE_DEFAULT_PCT_UNDER_BIN}% under lowest BIN)`;

  const lines: CostLine[] = [
    {
      label: `Tarantula Silk (×${TARANTULA_SILK_COUNT})`,
      cost:
        bazaarInstantSell(getProduct(products, "TARANTULA_SILK")) *
        TARANTULA_SILK_COUNT,
    },
    {
      label: `Tessellated Ender Pearl (×${TESSELLATED_ENDER_PEARL_COUNT})`,
      cost:
        bazaarInstantSell(getProduct(products, "TESSELLATED_ENDER_PEARL")) *
        TESSELLATED_ENDER_PEARL_COUNT,
    },
  ];

  if (options.braidedPricing === "bazaar") {
    lines.push({
      label: `Braided Griffin Feather (×${BRAIDED_GRIFFIN_FEATHER_COUNT}, bazaar)`,
      cost:
        bazaarInstantSell(getProduct(products, "BRAIDED_GRIFFIN_FEATHER")) *
        BRAIDED_GRIFFIN_FEATHER_COUNT,
    });
  } else {
    lines.push(
      {
        label: `Griffin Feather (×${GRIFFIN_FEATHER_PER_BRAIDED * BRAIDED_GRIFFIN_FEATHER_COUNT}, for ${BRAIDED_GRIFFIN_FEATHER_COUNT}× braided craft)`,
        cost:
          bazaarInstantSell(getProduct(products, "GRIFFIN_FEATHER")) *
          GRIFFIN_FEATHER_PER_BRAIDED *
          BRAIDED_GRIFFIN_FEATHER_COUNT,
      },
      {
        label: `Soul String (×${SOUL_STRING_PER_BRAIDED * BRAIDED_GRIFFIN_FEATHER_COUNT}, for ${BRAIDED_GRIFFIN_FEATHER_COUNT}× braided craft)`,
        cost:
          bazaarInstantSell(getProduct(products, "SOUL_STRING")) *
          SOUL_STRING_PER_BRAIDED *
          BRAIDED_GRIFFIN_FEATHER_COUNT,
      }
    );
  }

  if (options.nullBladePricing === "bazaar") {
    lines.push({
      label: `Null Blade (×${NULL_BLADE_COUNT}, bazaar)`,
      cost:
        bazaarInstantSell(getProduct(products, "NULL_BLADE")) * NULL_BLADE_COUNT,
    });
  } else {
    lines.push(
      {
        label: `Null Ovoid (×${NULL_OVOID_PER_BLADE * NULL_BLADE_COUNT}, for ${NULL_BLADE_COUNT}× Null Blade craft)`,
        cost:
          bazaarInstantSell(getProduct(products, "NULL_OVOID")) *
          NULL_OVOID_PER_BLADE *
          NULL_BLADE_COUNT,
      },
      {
        label: `Enchanted Quartz Block (×${ENCHANTED_QUARTZ_BLOCK_PER_BLADE * NULL_BLADE_COUNT}, for ${NULL_BLADE_COUNT}× Null Blade craft)`,
        cost:
          bazaarInstantSell(getProduct(products, "ENCHANTED_QUARTZ_BLOCK")) *
          ENCHANTED_QUARTZ_BLOCK_PER_BLADE *
          NULL_BLADE_COUNT,
      },
      {
        label: `Null Edge (×${NULL_EDGE_PER_BLADE * NULL_BLADE_COUNT}, for ${NULL_BLADE_COUNT}× Null Blade craft)`,
        cost:
          bazaarInstantSell(getProduct(products, "NULL_EDGE")) *
          NULL_EDGE_PER_BLADE *
          NULL_BLADE_COUNT,
      }
    );
  }

  lines.push({ label: judgementLabel, cost: judgementCost });

  const sections: CostSection[] = [
    {
      id: "terminator",
      title: "Terminator craft cost",
      lines,
      subtotalLabel: "Total Terminator craft cost",
      subtotal: sumSection(lines),
    },
  ];

  const total = sections.reduce((s, sec) => s + sec.subtotal, 0);
  return {
    sections,
    total,
    judgementLowestBin: judgementBin,
    judgementAutoCoins,
  };
}

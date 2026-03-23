import { getProduct } from "./bazaar";
import type { BazaarProduct } from "./bazaar";

/** Mana enchants that combine like ultimates (base × 2^(L−1)). */
const MANA_ENCHANTS = new Set([
  "MANA_VAMPIRE",
  "HARDENED_MANA",
  "STRONG_MANA",
  "FEROCIOUS_MANA",
]);

/** Tier 7 uses upgrade item + book 6 for these enchants. */
const TIER7_ITEMS: Record<string, string> = {
  BANE_OF_ARTHROPODS: "ENSNARED_SNAIL",
  SMITE: "SEVERED_HAND",
  VENOMOUS: "FATEFUL_STINGER",
};

/** CoflNet enchant type (snake_case) → Hypixel prefix (UPPER_SNAKE). */
export function enchantTypeToPrefix(type: string): string {
  return type.toUpperCase().replace(/-/g, "_");
}

/**
 * Get craft cost for an enchant at given level.
 * - Ultimate enchants (ULTIMATE_*) + Mana enchants: base level 1 price × 2^(L−1)
 * - All others: use direct bazaar book for that tier
 * - Tier 7 Bane/Smite/Venomous: book 6 + upgrade item
 */
export function getEnchantCost(
  prefix: string,
  level: number,
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number
): number {
  const tier = Math.min(10, Math.max(1, level));
  const tier7Item = TIER7_ITEMS[prefix];

  if (tier === 7 && tier7Item) {
    const book6 = instantSell(getProduct(products, `ENCHANTMENT_${prefix}_6`));
    const item = instantSell(getProduct(products, tier7Item));
    return book6 + item;
  }

  const usesCombinablePricing =
    prefix.startsWith("ULTIMATE_") || MANA_ENCHANTS.has(prefix);

  if (usesCombinablePricing) {
    const basePrice = instantSell(
      getProduct(products, `ENCHANTMENT_${prefix}_1`)
    );
    return Math.round(basePrice * Math.pow(2, tier - 1));
  }

  return instantSell(
    getProduct(products, `ENCHANTMENT_${prefix}_${tier}`)
  );
}

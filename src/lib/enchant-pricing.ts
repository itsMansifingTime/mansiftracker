import { getProduct } from "./bazaar";
import type { BazaarProduct } from "./bazaar";

/**
 * Mana enchants: tiers V–X = (lvl V book) × 2^(L−5); tiers I–IV = that tier’s book.
 */
const MANA_ENCHANTS = new Set([
  "MANA_VAMPIRE",
  "HARDENED_MANA",
  "STRONG_MANA",
  "FEROCIOUS_MANA",
]);

/** Bazaar only lists level I; higher tiers are combined (same formula as ultimates). */
const COMBINABLE_FROM_BOOK_ONE = new Set(["TOXOPHILITE"]);

/**
 * Tier VII with no `ENCHANTMENT_*_7` product (or empty book): book VI + this bazaar item.
 * Smite / Bane / Ender Slayer VII books usually exist — we still use this when direct price is 0.
 */
const TIER7_COMPOSED_ITEMS: Record<string, string> = {
  BANE_OF_ARTHROPODS: "ENSNARED_SNAIL",
  ENDER_SLAYER: "ENDSTONE_IDOL",
  SMITE: "SEVERED_HAND",
  VENOMOUS: "FATEFUL_STINGER",
};

/** Short / alternate NBT keys → Hypixel bazaar `ENCHANTMENT_${prefix}_${tier}` prefix. */
const ENCHANT_KEY_ALIASES: Record<string, string> = {
  bane: "BANE_OF_ARTHROPODS",
  arthropods: "BANE_OF_ARTHROPODS",
  ender: "ENDER_SLAYER",
  end: "ENDER_SLAYER",
};

/**
 * CoflNet / NBT enchant type (snake_case) → Hypixel bazaar prefix (UPPER_SNAKE).
 */
export function enchantTypeToPrefix(type: string): string {
  const key = type
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_");
  const alias = ENCHANT_KEY_ALIASES[key];
  if (alias) return alias;
  return type.trim().toUpperCase().replace(/-/g, "_");
}

/**
 * Bazaar cost for one enchant tier.
 * 1. Prefer direct `ENCHANTMENT_${prefix}_${tier}` when the order book has a price (e.g. Sharpness VII, Smite VII).
 * 2. Scavenger VI: book V + Golden Bounty (no VI book product).
 * 3. Tier VII composed: book VI + special item when direct VII book is missing / zero (e.g. Venomous).
 * 4. Mana / ultimate / toxophilite formulas, else direct book again (may be 0).
 */
export function getEnchantCost(
  prefix: string,
  level: number,
  products: Record<string, BazaarProduct>,
  priceBook: (p: BazaarProduct | undefined) => number
): number {
  const tier = Math.min(10, Math.max(1, Math.round(level)));
  const directKey = `ENCHANTMENT_${prefix}_${tier}`;
  const direct = priceBook(getProduct(products, directKey));
  if (direct > 0) {
    return direct;
  }

  /** Scavenger VI — crafted from V + Golden Bounty (Hypixel has no `ENCHANTMENT_SCAVENGER_6`). */
  if (prefix === "SCAVENGER" && tier === 6) {
    const book5 = priceBook(getProduct(products, "ENCHANTMENT_SCAVENGER_5"));
    const bounty = priceBook(getProduct(products, "GOLDEN_BOUNTY"));
    return book5 + bounty;
  }

  const tier7Item = TIER7_COMPOSED_ITEMS[prefix];
  if (tier === 7 && tier7Item) {
    const book6 = priceBook(getProduct(products, `ENCHANTMENT_${prefix}_6`));
    const item = priceBook(getProduct(products, tier7Item));
    return book6 + item;
  }

  if (MANA_ENCHANTS.has(prefix)) {
    if (tier < 5) {
      return priceBook(getProduct(products, `ENCHANTMENT_${prefix}_${tier}`));
    }
    const base5 = priceBook(getProduct(products, `ENCHANTMENT_${prefix}_5`));
    return Math.round(base5 * Math.pow(2, tier - 5));
  }

  const usesCombinablePricing =
    prefix.startsWith("ULTIMATE_") || COMBINABLE_FROM_BOOK_ONE.has(prefix);

  if (usesCombinablePricing) {
    const basePrice = priceBook(getProduct(products, `ENCHANTMENT_${prefix}_1`));
    return Math.round(basePrice * Math.pow(2, tier - 1));
  }

  return priceBook(getProduct(products, directKey));
}

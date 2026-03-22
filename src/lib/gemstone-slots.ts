import type { BazaarProduct } from "./bazaar";
import { getProduct } from "./bazaar";

/**
 * Gemstone slots (Hypixel SkyBlock).
 *
 * @see https://hypixel-skyblock.fandom.com/wiki/Gemstone_Slot
 *
 * The wiki defines slot families (e.g. ✎ Sapphire, ⚔ Combat), applying/removing
 * gems at Geo, and that “Cost to Unlock” is paid before a slot can hold a gem.
 * Per-item unlock recipes (coins + consumed flawless gems) are defined in-game;
 * the table on the wiki is item-specific.
 *
 * Geo fee to **apply** a gem (not unlock) by tier:
 */
export const GEO_APPLY_GEM_COINS = {
  rough: 1,
  flawed: 100,
  fine: 10_000,
  flawless: 100_000,
  perfect: 500_000,
} as const;

/** Official wiki page (slot types, mechanics, apply/remove costs). */
export const WIKI_GEMSTONE_SLOT_PAGE =
  "https://hypixel-skyblock.fandom.com/wiki/Gemstone_Slot" as const;

/**
 * Necron’s Blade (Hyperion): one ✎ Sapphire slot and one ⚔ Combat slot — two
 * unlock steps before gems can be applied.
 */
export const HYPERION_GEMSTONE_UNLOCK_STEPS = 2 as const;

export type HyperionSlotUnlockRecipe = {
  label: string;
  coins: number;
  items: { productId: string; count: number }[];
};

/**
 * Unlock costs for Hyperion’s two slots (coins + bazaar flawless gems consumed
 * at unlock). Aligns with common in-game / community breakdowns for this
 * weapon; verify against Geo if Hypixel changes recipes.
 */
export const HYPERION_SLOT_UNLOCK_RECIPES: readonly [
  HyperionSlotUnlockRecipe,
  HyperionSlotUnlockRecipe,
] = [
  {
    label: "✎ Sapphire slot (unlock)",
    coins: 250_000,
    items: [{ productId: "FLAWLESS_SAPPHIRE_GEM", count: 4 }],
  },
  {
    label: "⚔ Combat slot (unlock)",
    coins: 250_000,
    items: [
      { productId: "FLAWLESS_JASPER_GEM", count: 1 },
      { productId: "FLAWLESS_SAPPHIRE_GEM", count: 1 },
      { productId: "FLAWLESS_RUBY_GEM", count: 1 },
      { productId: "FLAWLESS_AMETHYST_GEM", count: 1 },
    ],
  },
];

export function hyperionSlotUnlockCost(
  recipe: HyperionSlotUnlockRecipe,
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number
): number {
  let total = recipe.coins;
  for (const { productId, count } of recipe.items) {
    total += instantSell(getProduct(products, productId)) * count;
  }
  return total;
}

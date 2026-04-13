import type { BazaarProduct } from "./bazaar";
import { getProduct } from "./bazaar";
import { parseKuudraArmorTag } from "./kuudra-armor-crafting";

/**
 * Gemstone slots (Hypixel SkyBlock).
 *
 * @see https://hypixel-skyblock.fandom.com/wiki/Gemstone_Slot
 *
 * Full-page snapshot (craft calculator reference): `src/lib/data/gemstone-slot-wiki.md`
 * (loaded via `readGemstoneSlotWikiMarkdown` in `gemstone-slot-wiki.ts`).
 *
 * The wiki explains slot **families** (✎ Sapphire, ⚔ Combat, etc.), Geo mechanics,
 * and removal costs. It does **not** ship a single machine-readable table of every
 * item’s unlock recipe — those are **per item** in-game at Geo (coins + consumed
 * flawless gems) and are often summarized on each item’s wiki page.
 *
 * In this repo, structured unlock data lives here only:
 * - Necron’s Blade line (`HYPERION`, `VALKYRIE`, `ASTRAEA`, `SCYLLA`) →
 *   {@link HYPERION_SLOT_UNLOCK_RECIPES}
 * - Kuudra-family armor (Crimson / Aurora / Fervor / Terror / Hollow, all tiers) →
 *   same two Geo steps as Necron blades (✎ Sapphire + ⚔ Combat); see
 *   {@link getGemSlotUnlockRecipesForItem}.
 * - Any other item → add an entry to {@link GEM_SLOT_UNLOCK_RECIPES_BY_ITEM_ID}
 *   (key = normalized `ExtraAttributes.id`, e.g. `SHADOW_ASSASSIN_HELMET`), using
 *   in-game / wiki values.
 *
 * Geo coin cost to **remove** a gemstone (wiki “Cost to remove”). Applying a gem
 * is free aside from any **slot unlock** cost at Geo.
 */
export const GEO_REMOVE_GEM_COINS = {
  rough: 1,
  flawed: 100,
  fine: 10_000,
  flawless: 100_000,
  perfect: 500_000,
} as const;

/** @deprecated Use {@link GEO_REMOVE_GEM_COINS} (same values; old name was misleading). */
export const GEO_APPLY_GEM_COINS = GEO_REMOVE_GEM_COINS;

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

/** Alias — same shape for non-Hyperion items in {@link GEM_SLOT_UNLOCK_RECIPES_BY_ITEM_ID}. */
export type GemSlotUnlockRecipe = HyperionSlotUnlockRecipe;

/** SkyBlock often uses `HYPERION;1` (tier) in `ExtraAttributes.id`. */
export function normalizeSkyblockItemId(raw: string): string {
  const t = raw.trim().toUpperCase();
  const head = t.split(";")[0]?.split(":")[0] ?? t;
  return head;
}

function extraIdString(extra: Record<string, unknown>): string | null {
  const v = extra.id ?? extra.Id;
  if (typeof v === "string" && v.trim()) return v;
  return null;
}

/**
 * Prefer `ExtraAttributes.id`, then Cofl auction tag, for display / single-id use.
 * For unlock recipes, use {@link getGemSlotUnlockRecipesForExtraAndTag} — Cofl merged
 * NBT sometimes carries a non–SkyBlock `id` first, which would hide the real tag.
 */
export function resolveSkyblockItemIdForUnlocks(
  extra: Record<string, unknown>,
  itemTag?: string
): string {
  const fromExtra = extraIdString(extra);
  if (fromExtra) return normalizeSkyblockItemId(fromExtra);
  if (itemTag?.trim()) return normalizeSkyblockItemId(itemTag);
  return "";
}

function stripMcColorCodes(s: string): string {
  return s.replace(/§./g, "").replace(/\u00a7./g, "");
}

const NECRON_BLADE_IDS = new Set([
  "HYPERION",
  "VALKYRIE",
  "ASTRAEA",
  "SCYLLA",
]);

/** Necron’s Blade line — same craft breakdown as Hyperion (handle + catalyst + LASR, etc.). */
export function isNecronsBladeItemId(raw: string): boolean {
  return NECRON_BLADE_IDS.has(normalizeSkyblockItemId(raw));
}

/**
 * Optional Geo unlock recipes for items other than the Necron’s Blade line.
 * Key: normalized `ExtraAttributes.id` (e.g. `SHADOW_ASSASSIN_HELMET` — verify in-game).
 * Value: ordered steps (same as {@link HYPERION_SLOT_UNLOCK_RECIPES}).
 *
 * Populate from Geo / wiki item pages; keep Necron blades out (handled automatically).
 */
export const GEM_SLOT_UNLOCK_RECIPES_BY_ITEM_ID: Record<
  string,
  readonly GemSlotUnlockRecipe[]
> = {};

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

/** Same as {@link hyperionSlotUnlockCost} — name reflects any item’s unlock recipe. */
export const gemSlotUnlockCost = hyperionSlotUnlockCost;

/**
 * Geo slot-unlock steps for breakdown pricing. Returns Necron-blade recipes when
 * `id` is one of `HYPERION` / `VALKYRIE` / `ASTRAEA` / `SCYLLA`; Kuudra armor tags
 * (e.g. `CRIMSON_CHESTPLATE`, `INFERNAL_AURORA_HELMET`) use the same ✎/⚔ steps;
 * otherwise looks up {@link GEM_SLOT_UNLOCK_RECIPES_BY_ITEM_ID}.
 */
export function getGemSlotUnlockRecipesForItem(
  normalizedItemId: string
): readonly GemSlotUnlockRecipe[] | null {
  if (!normalizedItemId) return null;
  if (NECRON_BLADE_IDS.has(normalizedItemId)) {
    return HYPERION_SLOT_UNLOCK_RECIPES;
  }
  const custom = GEM_SLOT_UNLOCK_RECIPES_BY_ITEM_ID[normalizedItemId];
  if (custom && custom.length > 0) return custom;
  if (parseKuudraArmorTag(normalizedItemId)) {
    return HYPERION_SLOT_UNLOCK_RECIPES;
  }
  return null;
}

/**
 * Unlock steps for modifier breakdown: try every candidate from `extra.id` and
 * `itemTag`, then infer Necron’s Blade from `itemName` (Cofl §-coded names).
 * Needed because merged NBT may put a non–SkyBlock `id` first and shadow the tag.
 */
export function getGemSlotUnlockRecipesForExtraAndTag(
  extra: Record<string, unknown>,
  itemTag?: string,
  itemName?: string
): readonly GemSlotUnlockRecipe[] | null {
  const candidates: string[] = [];
  const push = (raw: string) => {
    const n = normalizeSkyblockItemId(raw);
    if (n && !candidates.includes(n)) candidates.push(n);
  };

  /** Prefer Cofl listing tag — it matches AH SkyBlock id; merged `extra.id` is often wrong. */
  if (itemTag?.trim()) push(itemTag);
  const fromExtra = extraIdString(extra);
  if (fromExtra) push(fromExtra);

  for (const id of candidates) {
    const r = getGemSlotUnlockRecipesForItem(id);
    if (r) return r;
  }

  if (itemName?.trim()) {
    const plain = stripMcColorCodes(itemName).toUpperCase();
    if (
      plain.includes("HYPERION") ||
      plain.includes("VALKYRIE") ||
      plain.includes("ASTRAEA") ||
      plain.includes("SCYLLA")
    ) {
      return HYPERION_SLOT_UNLOCK_RECIPES;
    }
  }

  return null;
}

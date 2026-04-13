import type { BazaarProduct } from "./bazaar";

/**
 * `ExtraAttributes.modifier` (lowercase key) → Hypixel bazaar `product_id` for the
 * matching Reforge Stone / orb / consumable. Sourced from wiki Reforge Stones tables
 * and in-game ids; extend as needed.
 *
 * Reforges with **no** bazaar item (blacksmith-only coins) are omitted — see
 * {@link trySuffixStoneProductId}.
 */
export const REFORGE_STONE_BAZAAR_BY_MODIFIER: Record<string, string> = {
  // Armor (common wiki / Geo)
  bulky: "BULKY_STONE",
  candied: "CANDY_CORN",
  submerged: "DEEP_SEA_ORB",
  reinforced: "RARE_DIAMOND",
  giant: "GIANT_TOOTH",
  ancient: "DRAGON_SCALE",
  bouncy: "BOUNCY_BEACH_BALL",
  spicy: "MOIL_LOG",
  loving: "FLOWERING_BOUQUET",
  perfect: "GOLDEN_BALL",
  renowned: "RED_NOSE",
  gentle: "FROZEN_BAUBLE",
  neat: "SALMON_OPAL",
  outrageous: "RED_SCARF",
  hurtful: "BEADY_EYES",
  rich: "LUXURIOUS_SPOOL",
  spiritual: "SPIRIT_DECOY",
  headstrong: "DRAGON_CLAW",
  ridiculous: "PREMIUM_FLESH",
  cold: "FRIGID_HUSK",
  dirty: "DIRT_BOTTLE",
  heated: "MOLTEN_CUBE",
  blessed: "BLESSED_FRUIT",
  churning: "PITCHIN_KOI",
  // Weapons / bows / misc
  withered: "WITHER_BLOOD",
  warped: "AOTE_STONE",
  arcane: "JADERALD",
  precise: "OPTICAL_LENS",
  critical: "FULL_JAW_FANGING_KIT",
  fabled: "PITCHIN_KOI",
  itchy: "MOIL_LOG",
  salty: "SALT_CUBE",
  treacherous: "RUSTY_ANCHOR",
};

export function normalizeReforgeModifierKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function bazaarHasOrders(products: Record<string, BazaarProduct>, id: string): boolean {
  const p = products[id];
  return Boolean(
    p &&
      ((p.sell_summary?.length ?? 0) > 0 ||
        (p.buy_summary?.length ?? 0) > 0 ||
        (p.quick_status?.sellVolume ?? 0) > 0 ||
        (p.quick_status?.buyVolume ?? 0) > 0)
  );
}

/**
 * `MODIFIER` + `_STONE` when that product exists (e.g. bulky → BULKY_STONE).
 * Does not cover submerged → DEEP_SEA_ORB — use {@link REFORGE_STONE_BAZAAR_BY_MODIFIER}.
 */
export function trySuffixStoneProductId(
  modifierKey: string,
  products: Record<string, BazaarProduct>
): string | null {
  if (!modifierKey) return null;
  const id = `${modifierKey.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_STONE`;
  return bazaarHasOrders(products, id) ? id : null;
}

export type ResolvedReforgeStone = {
  productId: string;
  source: "explicit" | "suffix_stone";
};

/**
 * Bazaar product id for applying this reforge, or null if unknown / blacksmith-only.
 */
export function resolveReforgeStoneProduct(
  modifierRaw: string,
  products: Record<string, BazaarProduct>
): ResolvedReforgeStone | null {
  const key = normalizeReforgeModifierKey(modifierRaw);
  if (!key) return null;

  const explicit = REFORGE_STONE_BAZAAR_BY_MODIFIER[key];
  if (explicit && bazaarHasOrders(products, explicit)) {
    return { productId: explicit, source: "explicit" };
  }

  const suffix = trySuffixStoneProductId(key, products);
  if (suffix) {
    return { productId: suffix, source: "suffix_stone" };
  }

  return null;
}

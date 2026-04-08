/**
 * Kuudra-family armor (Crimson, Aurora, Fervor, Terror, Hollow): Essence Crafting
 * costs match the Crimson Armor wiki — stars + prestige are identical per set;
 * only the base drop piece differs.
 *
 * @see https://hypixel-skyblock.fandom.com/wiki/Crimson_Armor#Essence_Crafting
 *
 * Path: Basic piece → 10★ → prestige → Hot → … → Infernal. Infernal has 15★ steps (no further prestige).
 */

import type { BazaarProduct } from "./bazaar";
import { getProduct } from "./bazaar";

export const KUUDRA_ARMOR_WIKI_CRIMSON =
  "https://hypixel-skyblock.fandom.com/wiki/Crimson_Armor#Essence_Crafting" as const;

/** Hypixel bazaar product ids used for material pricing. */
export const KUUDRA_CRAFT_BAZAAR = {
  essence: "ESSENCE_CRIMSON",
  heavyPearl: "HEAVY_PEARL",
  kuudraTeeth: "KUUDRA_TEETH",
} as const;

export type KuudraEndTier = "hot" | "burning" | "fiery" | "infernal";

/** Tier of the piece itself (Basic = Kuudra drop with no prestige prefix). */
export type KuudraPieceTier = "basic" | KuudraEndTier;

export type KuudraArmorFamilyId =
  | "crimson"
  | "aurora"
  | "fervor"
  | "terror"
  | "hollow";

export const KUUDRA_ARMOR_FAMILIES: {
  id: KuudraArmorFamilyId;
  label: string;
  wikiNote: string;
}[] = [
  {
    id: "crimson",
    label: "Crimson",
    wikiNote: "Crimson Armor",
  },
  {
    id: "aurora",
    label: "Aurora",
    wikiNote: "Aurora Armor (same Essence table)",
  },
  {
    id: "fervor",
    label: "Fervor",
    wikiNote: "Fervor Armor (same Essence table)",
  },
  {
    id: "terror",
    label: "Terror",
    wikiNote: "Terror Armor (same Essence table)",
  },
  {
    id: "hollow",
    label: "Hollow",
    wikiNote: "Hollow Armor (same Essence table)",
  },
];

/** One Essence Crafting row (per armor piece). */
export type KuudraCraftStep = {
  label: string;
  essence: number;
  heavyPearls: number;
  kuudraTeeth: number;
  /** Blacksmith coin fee (not Bazaar). */
  blacksmithCoins: number;
};

function step(
  label: string,
  essence: number,
  opts: {
    heavyPearls?: number;
    kuudraTeeth?: number;
    blacksmithCoins?: number;
  } = {}
): KuudraCraftStep {
  return {
    label,
    essence,
    heavyPearls: opts.heavyPearls ?? 0,
    kuudraTeeth: opts.kuudraTeeth ?? 0,
    blacksmithCoins: opts.blacksmithCoins ?? 0,
  };
}

/** Basic tier: 10★ then prestige → Hot. */
const BASIC_STARS: KuudraCraftStep[] = [
  step("Basic ★1", 30),
  step("Basic ★2", 35),
  step("Basic ★3", 40),
  step("Basic ★4", 45, { blacksmithCoins: 10_000 }),
  step("Basic ★5", 50, { blacksmithCoins: 25_000 }),
  step("Basic ★6", 55, { blacksmithCoins: 50_000 }),
  step("Basic ★7", 60, { blacksmithCoins: 100_000 }),
  step("Basic ★8", 70, { heavyPearls: 2, blacksmithCoins: 250_000 }),
  step("Basic ★9", 80, { heavyPearls: 3, blacksmithCoins: 500_000 }),
  step("Basic ★10", 90, { heavyPearls: 4, blacksmithCoins: 1_000_000 }),
];

const BASIC_PRESTIGE = step("Basic → Hot (prestige)", 150, {
  kuudraTeeth: 10,
  blacksmithCoins: 2_000_000,
});

const HOT_STARS: KuudraCraftStep[] = [
  step("Hot ★1", 170),
  step("Hot ★2", 190),
  step("Hot ★3", 215),
  step("Hot ★4", 240, { blacksmithCoins: 10_000 }),
  step("Hot ★5", 270, { blacksmithCoins: 25_000 }),
  step("Hot ★6", 300, { blacksmithCoins: 50_000 }),
  step("Hot ★7", 340, { blacksmithCoins: 100_000 }),
  step("Hot ★8", 390, { heavyPearls: 3, blacksmithCoins: 250_000 }),
  step("Hot ★9", 440, { heavyPearls: 4, blacksmithCoins: 500_000 }),
  step("Hot ★10", 500, { heavyPearls: 5, blacksmithCoins: 1_000_000 }),
];

const HOT_PRESTIGE = step("Hot → Burning (prestige)", 800, {
  kuudraTeeth: 20,
  blacksmithCoins: 5_000_000,
});

const BURNING_STARS: KuudraCraftStep[] = [
  step("Burning ★1", 900),
  step("Burning ★2", 1_000),
  step("Burning ★3", 1_125),
  step("Burning ★4", 1_270, { blacksmithCoins: 10_000 }),
  step("Burning ★5", 1_450, { blacksmithCoins: 25_000 }),
  step("Burning ★6", 1_650, { blacksmithCoins: 50_000 }),
  step("Burning ★7", 1_850, { blacksmithCoins: 100_000 }),
  step("Burning ★8", 2_100, { heavyPearls: 3, blacksmithCoins: 250_000 }),
  step("Burning ★9", 2_350, { heavyPearls: 4, blacksmithCoins: 500_000 }),
  step("Burning ★10", 2_650, { heavyPearls: 5, blacksmithCoins: 1_000_000 }),
];

const BURNING_PRESTIGE = step("Burning → Fiery (prestige)", 4_500, {
  kuudraTeeth: 50,
  blacksmithCoins: 10_000_000,
});

const FIERY_STARS: KuudraCraftStep[] = [
  step("Fiery ★1", 5_000),
  step("Fiery ★2", 5_600),
  step("Fiery ★3", 6_300),
  step("Fiery ★4", 7_000, { blacksmithCoins: 10_000 }),
  step("Fiery ★5", 8_000, { blacksmithCoins: 25_000 }),
  step("Fiery ★6", 9_000, { blacksmithCoins: 50_000 }),
  step("Fiery ★7", 10_200, { blacksmithCoins: 100_000 }),
  step("Fiery ★8", 11_500, { heavyPearls: 3, blacksmithCoins: 250_000 }),
  step("Fiery ★9", 13_000, { heavyPearls: 4, blacksmithCoins: 500_000 }),
  step("Fiery ★10", 14_500, { heavyPearls: 5, blacksmithCoins: 1_000_000 }),
];

const FIERY_PRESTIGE = step("Fiery → Infernal (prestige)", 25_500, {
  kuudraTeeth: 80,
  blacksmithCoins: 20_000_000,
});

/** Infernal: 15★ steps (wiki table), no further prestige. */
const INFERNAL_STARS: KuudraCraftStep[] = [
  step("Infernal ★1", 30_000),
  step("Infernal ★2", 35_000),
  step("Infernal ★3", 41_000),
  step("Infernal ★4", 48_000, { blacksmithCoins: 10_000 }),
  step("Infernal ★5", 56_000, { blacksmithCoins: 25_000 }),
  step("Infernal ★6", 65_500, { blacksmithCoins: 50_000 }),
  step("Infernal ★7", 76_000, { blacksmithCoins: 100_000 }),
  step("Infernal ★8", 89_000, { heavyPearls: 3, blacksmithCoins: 250_000 }),
  step("Infernal ★9", 105_000, { heavyPearls: 4, blacksmithCoins: 500_000 }),
  step("Infernal ★10", 120_000, { heavyPearls: 5, blacksmithCoins: 1_000_000 }),
  step("Infernal ★11", 140_000, { heavyPearls: 10, blacksmithCoins: 2_500_000 }),
  step("Infernal ★12", 165_000, { heavyPearls: 15, blacksmithCoins: 5_000_000 }),
  step("Infernal ★13", 192_000, { heavyPearls: 20, blacksmithCoins: 10_000_000 }),
  step("Infernal ★14", 225_000, { heavyPearls: 30, blacksmithCoins: 25_000_000 }),
  step("Infernal ★15", 265_000, { heavyPearls: 40, blacksmithCoins: 50_000_000 }),
];

export const KUUDRA_INFERNAL_STAR_COUNT = INFERNAL_STARS.length;

const TAG_TIER_PREFIX: Record<string, KuudraEndTier> = {
  HOT: "hot",
  BURNING: "burning",
  FIERY: "fiery",
  INFERNAL: "infernal",
};

/**
 * Match Cofl/Hypixel armor tags, e.g. `BURNING_CRIMSON_CHESTPLATE` or `AURORA_BOOTS`.
 */
export function parseKuudraArmorTag(tag: string): {
  baseTag: string;
  pieceTier: KuudraPieceTier;
  family: string;
  slot: string;
} | null {
  const t = tag.trim().toUpperCase();
  const m = t.match(
    /^(?:(INFERNAL|FIERY|BURNING|HOT)_)?(CRIMSON|AURORA|FERVOR|TERROR|HOLLOW)_(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/
  );
  if (!m) return null;
  const prefix = m[1];
  const family = m[2];
  const slot = m[3];
  const baseTag = `${family}_${slot}`;
  if (prefix) {
    const tier = TAG_TIER_PREFIX[prefix];
    if (!tier) return null;
    return { baseTag, pieceTier: tier, family, slot };
  }
  return { baseTag, pieceTier: "basic", family, slot };
}

/**
 * Essence path from a Basic drop to the current tier, including only the first
 * `starsOnCurrentTier` star rows on the **current** tier (0–10, or 0–15 on Infernal).
 */
export function getKuudraArmorCraftStepsForPiece(
  pieceTier: KuudraPieceTier,
  starsOnCurrentTier: number
): KuudraCraftStep[] {
  const maxStars = pieceTier === "infernal" ? KUUDRA_INFERNAL_STAR_COUNT : 10;
  const starCount = Math.min(
    maxStars,
    Math.max(0, Math.floor(starsOnCurrentTier))
  );

  const steps: KuudraCraftStep[] = [];

  if (pieceTier === "basic") {
    steps.push(...BASIC_STARS.slice(0, starCount));
    return steps;
  }
  steps.push(...BASIC_STARS, BASIC_PRESTIGE);
  if (pieceTier === "hot") {
    steps.push(...HOT_STARS.slice(0, starCount));
    return steps;
  }
  steps.push(...HOT_STARS, HOT_PRESTIGE);
  if (pieceTier === "burning") {
    steps.push(...BURNING_STARS.slice(0, starCount));
    return steps;
  }
  steps.push(...BURNING_STARS, BURNING_PRESTIGE);
  if (pieceTier === "fiery") {
    steps.push(...FIERY_STARS.slice(0, starCount));
    return steps;
  }
  steps.push(...FIERY_STARS, FIERY_PRESTIGE);
  steps.push(...INFERNAL_STARS.slice(0, starCount));
  return steps;
}

export type KuudraPricedLine = { label: string; cost: number };

/** Bazaar (essence / pearls / teeth) + blacksmith coin fees. */
export function priceKuudraCraftMaterials(
  steps: KuudraCraftStep[],
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number
): { lines: KuudraPricedLine[]; total: number } {
  const m = sumKuudraCraftSteps(steps);
  const lines: KuudraPricedLine[] = [];

  if (m.essence > 0) {
    const u = instantSell(getProduct(products, KUUDRA_CRAFT_BAZAAR.essence));
    lines.push({
      label: `Crimson Essence (×${m.essence.toLocaleString()})`,
      cost: Math.round(u * m.essence),
    });
  }
  if (m.heavyPearls > 0) {
    const u = instantSell(getProduct(products, KUUDRA_CRAFT_BAZAAR.heavyPearl));
    lines.push({
      label: `Heavy Pearl (×${m.heavyPearls})`,
      cost: Math.round(u * m.heavyPearls),
    });
  }
  if (m.kuudraTeeth > 0) {
    const u = instantSell(getProduct(products, KUUDRA_CRAFT_BAZAAR.kuudraTeeth));
    lines.push({
      label: `Kuudra Teeth (×${m.kuudraTeeth})`,
      cost: Math.round(u * m.kuudraTeeth),
    });
  }
  if (m.blacksmithCoins > 0) {
    lines.push({
      label: "Blacksmith coin fees (wiki)",
      cost: m.blacksmithCoins,
    });
  }

  if (lines.length === 0) {
    lines.push({ label: "No essence path rows", cost: 0 });
  }

  const total = lines.reduce((s, l) => s + l.cost, 0);
  return { lines, total };
}

/**
 * Full upgrade path from a Basic-tier drop piece: always Basic 10★ + prestige,
 * then each higher tier’s 10★ + prestige, then Infernal ★1–N.
 *
 * When `endTier` is `infernal` and `infernalStars` is omitted, defaults to **0**
 * (Fiery→Infernal prestige only — same cumulative as wiki “Infernal tier, ★0”).
 * Pass `infernalStars: KUUDRA_INFERNAL_STAR_COUNT` for the full 15★ Infernal path.
 */
export function getKuudraArmorCraftSteps(options: {
  endTier: KuudraEndTier;
  /** Infernal stars 0–15 when endTier is infernal (default 0). */
  infernalStars?: number;
}): KuudraCraftStep[] {
  const infernalStars = Math.min(
    KUUDRA_INFERNAL_STAR_COUNT,
    Math.max(0, Math.floor(options.infernalStars ?? 0))
  );

  const out: KuudraCraftStep[] = [];

  out.push(...BASIC_STARS, BASIC_PRESTIGE);
  if (options.endTier === "hot") return out;

  out.push(...HOT_STARS, HOT_PRESTIGE);
  if (options.endTier === "burning") return out;

  out.push(...BURNING_STARS, BURNING_PRESTIGE);
  if (options.endTier === "fiery") return out;

  out.push(...FIERY_STARS, FIERY_PRESTIGE);
  out.push(...INFERNAL_STARS.slice(0, infernalStars));
  return out;
}

export function sumKuudraCraftSteps(steps: KuudraCraftStep[]): {
  essence: number;
  heavyPearls: number;
  kuudraTeeth: number;
  blacksmithCoins: number;
} {
  return steps.reduce(
    (acc, s) => ({
      essence: acc.essence + s.essence,
      heavyPearls: acc.heavyPearls + s.heavyPearls,
      kuudraTeeth: acc.kuudraTeeth + s.kuudraTeeth,
      blacksmithCoins: acc.blacksmithCoins + s.blacksmithCoins,
    }),
    { essence: 0, heavyPearls: 0, kuudraTeeth: 0, blacksmithCoins: 0 }
  );
}

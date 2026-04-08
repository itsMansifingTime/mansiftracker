/** How to price Braided Griffin Feather / Null Blade: bazaar item or craft mats. */
export type TerminatorPartPricing = "bazaar" | "craft";

/** Bow enchant rows: Hypixel bazaar `ENCHANTMENT_${prefix}_${tier}` (or combinable). */
export const TERMINATOR_BOW_ENCHANT_ROWS = [
  {
    key: "tierToxophilite",
    label: "Toxophilite",
    prefix: "TOXOPHILITE",
    maxTier: 10,
  },
  { key: "tierChance", label: "Chance", prefix: "CHANCE", maxTier: 5 },
  { key: "tierCubism", label: "Cubism", prefix: "CUBISM", maxTier: 6 },
  { key: "tierFlame", label: "Flame", prefix: "FLAME", maxTier: 2 },
  {
    key: "tierImpaling",
    label: "Impaling",
    prefix: "IMPALING",
    maxTier: 3,
  },
  {
    key: "tierInfiniteQuiver",
    label: "Infinite Quiver",
    prefix: "INFINITE_QUIVER",
    maxTier: 10,
  },
  { key: "tierOverload", label: "Overload", prefix: "OVERLOAD", maxTier: 5 },
  {
    key: "tierPiercing",
    label: "Piercing",
    prefix: "PIERCING",
    maxTier: 1,
  },
  { key: "tierPower", label: "Power", prefix: "POWER", maxTier: 7 },
  { key: "tierSnipe", label: "Snipe", prefix: "SNIPE", maxTier: 4 },
] as const;

export type TerminatorBowEnchantRow =
  (typeof TERMINATOR_BOW_ENCHANT_ROWS)[number];

export type TerminatorCraftOptions = {
  braidedPricing: TerminatorPartPricing;
  nullBladePricing: TerminatorPartPricing;
  /** 0 = off; 1–5 = Ultimate Duplex tier (bazaar combinable pricing). */
  tierDuplex: number;
  /** 0 = off; 1–5 = Ultimate Soul Eater tier. */
  tierSoulEater: number;
  tierToxophilite: number;
  tierChance: number;
  tierCubism: number;
  tierFlame: number;
  tierImpaling: number;
  tierInfiniteQuiver: number;
  tierOverload: number;
  tierPiercing: number;
  tierPower: number;
  tierSnipe: number;
  /** 0–10 Hot Potato Books (same item as Hyperion). */
  hotPotatoBooksCount: number;
  includeFumingPotatoBook: boolean;
  includeRecomb: boolean;
  /** Bazaar `THE_ART_OF_WAR`. */
  includeArtOfWar: boolean;
};

export const TERMINATOR_ENCHANT_TIER_OPTIONS: {
  value: number;
  label: string;
}[] = [
  { value: 0, label: "Off" },
  { value: 1, label: "I" },
  { value: 2, label: "II" },
  { value: 3, label: "III" },
  { value: 4, label: "IV" },
  { value: 5, label: "V" },
];

/** Roman labels up to X for per-enchant max tiers. */
export function tierSelectOptions(maxTier: number): {
  value: number;
  label: string;
}[] {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const out: { value: number; label: string }[] = [
    { value: 0, label: "Off" },
  ];
  for (let i = 1; i <= maxTier; i++) {
    out.push({ value: i, label: roman[i - 1] ?? String(i) });
  }
  return out;
}

export const DEFAULT_TERMINATOR_CRAFT_OPTIONS: TerminatorCraftOptions = {
  braidedPricing: "craft",
  nullBladePricing: "craft",
  tierDuplex: 0,
  tierSoulEater: 0,
  tierToxophilite: 0,
  tierChance: 0,
  tierCubism: 0,
  tierFlame: 0,
  tierImpaling: 0,
  tierInfiniteQuiver: 0,
  tierOverload: 0,
  tierPiercing: 0,
  tierPower: 0,
  tierSnipe: 0,
  hotPotatoBooksCount: 10,
  includeFumingPotatoBook: false,
  includeRecomb: true,
  includeArtOfWar: false,
};

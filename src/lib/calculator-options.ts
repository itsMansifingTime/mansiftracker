export type GemSapphire = "none" | "flawless" | "perfect";

/** Hyperion: two slots (✎ + ⚔); priced sapphires when both use sapphire. */
export const SOCKETED_SAPPHIRE_COUNT = 2;

/** When handle is not overridden, cost = CoflNet lowest BIN × (1 − this). */
export const HANDLE_DEFAULT_PCT_UNDER_BIN = 3.5;

/** Hot Potato Books on the weapon — calculator always uses 10 (max). */
export const HOT_POTATO_BOOKS_COUNT = 10;

export const GEM_SAPPHIRE_OPTIONS: { value: GemSapphire; label: string }[] = [
  { value: "none", label: "None" },
  {
    value: "flawless",
    label: `Flawless (×${SOCKETED_SAPPHIRE_COUNT})`,
  },
  {
    value: "perfect",
    label: `Perfect (×${SOCKETED_SAPPHIRE_COUNT})`,
  },
];

export type CalculatorOptions = {
  starCount: number;
  /** Fuming Potato Book (after HPBs; bazaar). */
  includeFumingPotatoBook: boolean;
  includeTitanics: boolean;
  includeRecomb: boolean;
  tierUltimateWise: number;
  tierVampirism: number;
  tierSharpness: number;
  tierExperience: number;
  tierGiantKiller: number;
  tierEnderSlayer: number;
  tierVenomous: number;
  gemSlotsUnlocked: boolean;
  gemSapphire: GemSapphire;
  includeWitherShield: boolean;
  includeShadowWarp: boolean;
  includeImplosion: boolean;
};

export const DEFAULT_CALCULATOR_OPTIONS: CalculatorOptions = {
  /** 0–5 = regular ★ tiers; 6–10 = 5 regular + (slider−5) master ★ (max 5). */
  starCount: 5,
  includeFumingPotatoBook: false,
  includeTitanics: true,
  includeRecomb: true,
  tierUltimateWise: 5,
  tierVampirism: 6,
  tierSharpness: 6,
  tierExperience: 4,
  tierGiantKiller: 6,
  tierEnderSlayer: 6,
  tierVenomous: 6,
  gemSlotsUnlocked: false,
  gemSapphire: "flawless",
  includeWitherShield: true,
  includeShadowWarp: true,
  includeImplosion: true,
};

/** Full build used for snapshot when logging sales. */
export const TRACKER_SNAPSHOT_OPTIONS: CalculatorOptions = {
  starCount: 10,
  includeFumingPotatoBook: false,
  includeTitanics: true,
  includeRecomb: true,
  tierUltimateWise: 5,
  tierVampirism: 6,
  tierSharpness: 6,
  tierExperience: 4,
  tierGiantKiller: 6,
  tierEnderSlayer: 6,
  tierVenomous: 6,
  gemSlotsUnlocked: true,
  gemSapphire: "perfect",
  includeWitherShield: true,
  includeShadowWarp: true,
  includeImplosion: true,
};

/** Dropdown options: value → Hypixel enchant tier (0 = off). */
export const ENCHANT_DROPDOWNS: {
  key: keyof CalculatorOptions;
  label: string;
  prefix: string;
  options: { value: number; label: string }[];
}[] = [
  {
    key: "tierUltimateWise",
    label: "Ultimate Wise",
    prefix: "ULTIMATE_WISE",
    options: [
      { value: 0, label: "None" },
      { value: 5, label: "V" },
    ],
  },
  {
    key: "tierVampirism",
    label: "Vampirism",
    prefix: "VAMPIRISM",
    options: [
      { value: 0, label: "None" },
      { value: 5, label: "V" },
      { value: 6, label: "VI" },
    ],
  },
  {
    key: "tierSharpness",
    label: "Sharpness",
    prefix: "SHARPNESS",
    options: [
      { value: 0, label: "None" },
      { value: 4, label: "IV" },
      { value: 5, label: "V" },
      { value: 6, label: "VI" },
      { value: 7, label: "VII" },
    ],
  },
  {
    key: "tierExperience",
    label: "Experience",
    prefix: "EXPERIENCE",
    options: [
      { value: 0, label: "None" },
      { value: 4, label: "IV" },
      { value: 5, label: "V" },
    ],
  },
  {
    key: "tierGiantKiller",
    label: "Giant Killer",
    prefix: "GIANT_KILLER",
    options: [
      { value: 0, label: "None" },
      { value: 4, label: "IV" },
      { value: 5, label: "V" },
      { value: 6, label: "VI" },
      { value: 7, label: "VII" },
    ],
  },
  {
    key: "tierEnderSlayer",
    label: "Ender Slayer",
    prefix: "ENDER_SLAYER",
    options: [
      { value: 0, label: "None" },
      { value: 4, label: "IV" },
      { value: 5, label: "V" },
      { value: 6, label: "VI" },
      { value: 7, label: "VII" },
    ],
  },
  {
    key: "tierVenomous",
    label: "Venomous",
    prefix: "VENOMOUS",
    options: [
      { value: 0, label: "None" },
      { value: 4, label: "IV" },
      { value: 5, label: "V" },
      { value: 6, label: "VI" },
    ],
  },
];

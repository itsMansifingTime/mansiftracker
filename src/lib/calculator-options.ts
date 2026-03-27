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

/** Fixed enchants always included (never change). */
export const FIXED_ENCHANTS: { prefix: string; tier: number; label: string }[] =
  [
    { prefix: "ULTIMATE_WISE", tier: 5, label: "Ultimate Wise 5" },
    { prefix: "CLEAVE", tier: 5, label: "Cleave 5" },
    { prefix: "CRITICAL", tier: 6, label: "Critical 6" },
    { prefix: "CUBISM", tier: 5, label: "Cubism 5" },
    { prefix: "ENDER_SLAYER", tier: 6, label: "Ender Slayer 6" },
    { prefix: "EXECUTE", tier: 5, label: "Execute 5" },
    { prefix: "EXPERIENCE", tier: 4, label: "Experience 4" },
    { prefix: "FIRE_ASPECT", tier: 3, label: "Fire Aspect 3" },
    { prefix: "FIRST_STRIKE", tier: 4, label: "First Strike 4" },
    { prefix: "GIANT_KILLER", tier: 6, label: "Giant Killer 6" },
    { prefix: "IMPALING", tier: 5, label: "Impaling 5" },
    { prefix: "KNOCKBACK", tier: 2, label: "Knockback 2" },
    { prefix: "LETHALITY", tier: 6, label: "Lethality 6" },
    { prefix: "LOOTING", tier: 4, label: "Looting 4" },
    { prefix: "LUCK", tier: 6, label: "Luck 6" },
    { prefix: "SCAVENGER", tier: 5, label: "Scav 5" },
    { prefix: "SHARPNESS", tier: 6, label: "Sharpness 6" },
    { prefix: "VAMPIRISM", tier: 6, label: "Vampirism 6" },
  ];

export type CalculatorOptions = {
  starCount: number;
  /** Fuming Potato Book (after HPBs; bazaar). */
  includeFumingPotatoBook: boolean;
  includeTitanics: boolean;
  includeRecomb: boolean;
  tierBane: number;
  tierLifeSteal: number;
  tierSmite: number;
  tierVenomous: number;
  tierThunderlord: number;
  gemSlotsUnlocked: boolean;
  gemSapphire: GemSapphire;
  includeWitherShield: boolean;
  includeShadowWarp: boolean;
  includeImplosion: boolean;
  /** If true, use instant buy (sell_summary[0]); if false, use buy order (buy_summary[0]). */
  scrollsInstantBuy: boolean;
};

export const DEFAULT_CALCULATOR_OPTIONS: CalculatorOptions = {
  /** 0–5 = regular ★ tiers; 6–10 = 5 regular + (slider−5) master ★ (max 5). */
  starCount: 5,
  includeFumingPotatoBook: false,
  includeTitanics: true,
  includeRecomb: true,
  tierBane: 6,
  tierLifeSteal: 4,
  tierSmite: 6,
  tierVenomous: 6,
  tierThunderlord: 6,
  gemSlotsUnlocked: false,
  gemSapphire: "none",
  includeWitherShield: true,
  includeShadowWarp: true,
  includeImplosion: true,
  scrollsInstantBuy: true,
};

/** Full build used for snapshot when logging sales. */
export const TRACKER_SNAPSHOT_OPTIONS: CalculatorOptions = {
  starCount: 10,
  includeFumingPotatoBook: false,
  includeTitanics: true,
  includeRecomb: true,
  tierBane: 7,
  tierLifeSteal: 5,
  tierSmite: 7,
  tierVenomous: 7,
  tierThunderlord: 7,
  gemSlotsUnlocked: true,
  gemSapphire: "perfect",
  includeWitherShield: true,
  includeShadowWarp: true,
  includeImplosion: true,
  scrollsInstantBuy: true,
};

/** Dropdown options: user picks tier for variable enchants. */
export const ENCHANT_DROPDOWNS: {
  key: keyof CalculatorOptions;
  label: string;
  prefix: string;
  options: { value: number; label: string }[];
  /** When tier 7, use this bazaar product instead of ENCHANTMENT_prefix_7. */
  tier7ProductId?: string;
}[] = [
  {
    key: "tierBane",
    label: "Bane of Arthropods",
    prefix: "BANE_OF_ARTHROPODS",
    options: [
      { value: 6, label: "VI" },
      { value: 7, label: "VII" },
    ],
    tier7ProductId: "ENSNARED_SNAIL",
  },
  {
    key: "tierLifeSteal",
    label: "Life Steal",
    prefix: "LIFE_STEAL",
    options: [
      { value: 4, label: "IV" },
      { value: 5, label: "V" },
    ],
  },
  {
    key: "tierSmite",
    label: "Smite",
    prefix: "SMITE",
    options: [
      { value: 6, label: "VI" },
      { value: 7, label: "VII" },
    ],
    tier7ProductId: "SEVERED_HAND",
  },
  {
    key: "tierVenomous",
    label: "Venomous",
    prefix: "VENOMOUS",
    options: [
      { value: 6, label: "VI" },
      { value: 7, label: "VII" },
    ],
    tier7ProductId: "FATEFUL_STINGER",
  },
  {
    key: "tierThunderlord",
    label: "Thunderlord",
    prefix: "THUNDERLORD",
    options: [
      { value: 6, label: "VI" },
      { value: 7, label: "VII" },
    ],
  },
];

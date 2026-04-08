/**
 * Dye item ids for browse autocomplete (matches `dye_item` / `dye` / `Dye` on ExtraAttributes).
 * Sourced from the wiki Dyes page (main table, history, animated / Fire Sale mentions):
 * https://hypixel-skyblock.fandom.com/wiki/Dyes
 *
 * Hypixel naming is mixed (`DYE_*`, `*_DYE`, `PURE_*_DYE`, etc.); DB hints still merge in anything seen in data.
 */
export const SKYBLOCK_DYE_IDS_STATIC: readonly string[] = [
  // Animated / Fire Sale & changelog (see wiki History + Animated Dyes)
  "AURORA_DYE",
  "BLACK_ICE_DYE",
  "BLACK_OPAL_DYE",
  "DUSK_DYE",
  "FOREST_DYE",
  "FROG_DYE",
  "HELLEBORE_DYE",
  "JERRY_DYE",
  "KINGFISHER_DYE",
  "LAVA_DYE",
  "LUCKY_DYE",
  "OCEAN_DYE",
  "OVERGROWN_DYE",
  "PASTEL_SKY_DYE",
  "PORTAL_DYE",
  "ROSE_DYE",
  "SNOWFLAKE_DYE",
  "TREASURE_DYE",
  "WARDEN_DYE",

  // Main wiki table — https://hypixel-skyblock.fandom.com/wiki/Dyes § Dyes
  "BINGO_BLUE_DYE",
  "BONE_DYE",
  "CHOCOLATE_DYE",
  "COPPER_DYE",
  "EMERALD_DYE",
  "FLAME_DYE",
  "FOSSIL_DYE",
  "FROSTBITTEN_DYE",
  "HOLLY_DYE",
  "JADE_DYE",
  "LIVID_DYE",
  "MIDNIGHT_DYE",
  "MYTHOLOGICAL_DYE",
  "NADESHIKO_DYE",
  "NECRON_DYE",
  "NYANZA_DYE",
  "PEARLESCENT_DYE",
  "PELT_DYE",
  "PERIWINKLE_DYE",
  "PURE_BLACK_DYE",
  "PURE_BLUE_DYE",
  "PURE_WHITE_DYE",
  "PURE_YELLOW_DYE",
  "SECRET_DYE",

  "DYE_AQUAMARINE",
  "DYE_ARCHFIEND",
  "DYE_BRICK_RED",
  "DYE_BYZANTIUM",
  "DYE_CARMINE",
  "DYE_CELADON",
  "DYE_CELESTE",
  "DYE_CYCLAMEN",
  "DYE_DARK_PURPLE",
  "DYE_DUNG",
  "DYE_FROSTBITE", // legacy alias; game uses FROSTBITTEN_DYE — keep for search
  "DYE_ICEBERG",
  "DYE_MANGO",
  "DYE_MATCHA",
  "DYE_MOCHA",
  "DYE_SANGRIA",
  "DYE_TENTACLE",
  "DYE_WILD_STRAWBERRY",

  // Alternate spellings sometimes used / older references
  "DYE_PURE_BLACK",
  "DYE_PURE_BLUE",
  "DYE_PURE_WHITE",
  "DYE_PURE_YELLOW",
];

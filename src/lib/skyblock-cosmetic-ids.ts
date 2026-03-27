/**
 * Manual autocomplete hints for Dye / Rune / Skin browse filters (same UX as Enchant).
 * Keys should match Hypixel `ExtraAttributes` as stored in JSON (often SCREAMING_SNAKE_CASE).
 * Extend these lists anytime — substring matches only show ~30 rows.
 *
 * Skins: bulk list from the Fire Sale wiki (`skyblock-skin-ids-wiki.ts`), plus a few aliases.
 * https://hypixel-skyblock.fandom.com/wiki/Fire_Sale
 */
import { SKYBLOCK_SKIN_IDS_FROM_WIKI } from "./skyblock-skin-ids-wiki";

function buildDyeSet(): Set<string> {
  const s = new Set<string>();
  const add = (...keys: string[]) => {
    for (const k of keys) s.add(k);
  };

  // Fire Sale 2024 armor dyes (and nearby popular)
  add(
    "AURORA_DYE",
    "LAVA_DYE",
    "PASTEL_SKY_DYE",
    "ROSE_DYE",
    "PORTAL_DYE",
    "LUCKY_DYE",
    "WARDEN_DYE",
    "BLACK_OPAL_DYE",
    "FROG_DYE",
    "OCEAN_DYE"
  );

  return s;
}

function buildRuneSet(): Set<string> {
  const s = new Set<string>();
  const add = (...keys: string[]) => {
    for (const k of keys) s.add(k);
  };

  // Fire Sale 2024 + common weapon/armor rune keys (tier stored as value, not key name)
  add(
    "ORNAMENTAL",
    "GOLDEN_CARPET",
    "TURKEY",
    "PEAFOWL",
    "SOUL_SLICE",
    "FADING_RAINBOW",
    "CROWNED",
    "LIGHTNING",
    "SPIRIT",
    "BLOOD",
    "CRITICAL",
    "SNOW_SHOVEL",
    "ICE_SKATES",
    "ZAP",
    "GEMSTONE",
    "PARTY",
    "SNOWFLAKE",
    "ENCHANTING",
    "RED_NOSE"
  );

  return s;
}

function buildSkinSet(): Set<string> {
  const s = new Set<string>(SKYBLOCK_SKIN_IDS_FROM_WIKI);
  /** Alternate spellings / older guesses not covered by wiki slug rules. */
  const add = (...keys: string[]) => {
    for (const k of keys) s.add(k);
  };
  add("FIELD_MOUSE", "FIELD_MOUSE_DESPAIR");
  return s;
}

const DYE_SET = buildDyeSet();
const RUNE_SET = buildRuneSet();
const SKIN_SET = buildSkinSet();

export const SKYBLOCK_DYE_IDS: readonly string[] = [...DYE_SET].sort((a, b) =>
  a.localeCompare(b)
);
export const SKYBLOCK_RUNE_IDS: readonly string[] = [...RUNE_SET].sort((a, b) =>
  a.localeCompare(b)
);
export const SKYBLOCK_SKIN_IDS: readonly string[] = [...SKIN_SET].sort((a, b) =>
  a.localeCompare(b)
);

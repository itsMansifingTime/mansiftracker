/**
 * Optional autocomplete hints for the Enchant filter (browse page).
 * You can add hundreds or thousands of ids — only substring matches are shown (max 30 rows).
 * The filter accepts any valid snake_case key even if it is not listed here.
 */
function buildEnchantSet(): Set<string> {
  const s = new Set<string>();

  const add = (...keys: string[]) => {
    for (const k of keys) s.add(k);
  };

  // Vanilla-style (as stored in SkyBlock NBT)
  add(
    "aqua_affinity",
    "bane_of_arthropods",
    "blast_protection",
    "depth_strider",
    "efficiency",
    "feather_falling",
    "fire_aspect",
    "fire_protection",
    "flame",
    "fortune",
    "frost_walker",
    "impaling",
    "infinity",
    "knockback",
    "looting",
    "luck_of_the_sea",
    "lure",
    "mending",
    "multishot",
    "piercing",
    "power",
    "projectile_protection",
    "protection",
    "punch",
    "quick_charge",
    "respiration",
    "riptide",
    "sharpness",
    "silk_touch",
    "smite",
    "soul_speed",
    "sweeping_edge",
    "thorns",
    "unbreaking"
  );

  // Melee / sword
  add(
    "cleave",
    "critical",
    "cubism",
    "dragon_hunter",
    "ender_slayer",
    "execute",
    "experience",
    "ferocious_mana",
    "first_strike",
    "frail",
    "giant_killer",
    "hardened_mana",
    "lethality",
    "life_steal",
    "luck",
    "mana_steal",
    "overload",
    "prosecute",
    "scavenger",
    "strong_mana",
    "syphon",
    "thunderlord",
    "titan_killer",
    "triple_strike",
    "vampirism",
    "venomous",
    "vicious"
  );

  // Bow
  add(
    "aim",
    "chance",
    "dragon_tracer",
    "infinite_quiver",
    "snipe",
    "split_stream"
  );

  // Armor
  add(
    "big_brain",
    "counter_strike",
    "devour",
    "growth",
    "last_breath",
    "mana_vampire",
    "necrotic",
    "perfect",
    "rejuvenate",
    "reinforced",
    "resprout",
    "smarty_pants",
    "sugar_rush",
    "true_protection",
    "vibrant",
    "wisdom"
  );

  // Tools / mining / farming
  add(
    "compact",
    "cultivating",
    "dedication",
    "delicate",
    "fracture",
    "great_spook",
    "harvester",
    "replenish",
    "soulbound",
    "telekinesis",
    "tinker"
  );

  // Fishing
  add(
    "angler",
    "blessing",
    "caster",
    "magnet",
    "piscary",
    "spiked_hook"
  );

  // Ultimate (one per item)
  add(
    "ultimate_bank",
    "ultimate_chimera",
    "ultimate_duplex",
    "ultimate_fatal_tempo",
    "ultimate_jerry",
    "ultimate_last_stand",
    "ultimate_legion",
    "ultimate_soul_eater",
    "ultimate_wisdom",
    "ultimate_wise"
  );

  // Other keys seen in SkyBlock items
  add(
    "divine_gift",
    "fatal_tempo",
    "reflection",
    "smoldering",
    "transylvanian",
    "wither_hunter"
  );

  return s;
}

const SET = buildEnchantSet();

/** Sorted list for UI dropdowns */
export const SKYBLOCK_ENCHANT_IDS: readonly string[] = [...SET].sort((a, b) =>
  a.localeCompare(b)
);

export const SKYBLOCK_ENCHANT_ID_SET = new Set(SKYBLOCK_ENCHANT_IDS);

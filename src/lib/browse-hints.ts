/** Response from GET /api/browse/hints (distinct values from ended_auctions). */
export type BrowseFilterHints = {
  enchant_keys: string[];
  /** Distinct dye strings from `dye_item` / `dye` / `Dye` on stored auctions (merged into Dye filter hints). */
  dye_ids: string[];
  /** Top-level keys under `extra_attributes` (NBT slice), for NBT field filter autocomplete. */
  extra_attribute_keys: string[];
  modifiers: string[];
  item_rarities: string[];
  item_ids: string[];
};

export function emptyBrowseHints(): BrowseFilterHints {
  return {
    enchant_keys: [],
    dye_ids: [],
    extra_attribute_keys: [],
    modifiers: [],
    item_rarities: [],
    item_ids: [],
  };
}

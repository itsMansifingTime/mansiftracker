/** Response from GET /api/browse/hints (distinct values from ended_auctions). */
export type BrowseFilterHints = {
  enchant_keys: string[];
  /** Top-level keys under `extra_attributes` (NBT slice), for NBT field filter autocomplete. */
  extra_attribute_keys: string[];
  modifiers: string[];
  item_rarities: string[];
  item_ids: string[];
};

export function emptyBrowseHints(): BrowseFilterHints {
  return {
    enchant_keys: [],
    extra_attribute_keys: [],
    modifiers: [],
    item_rarities: [],
    item_ids: [],
  };
}

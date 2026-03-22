/**
 * Regular (gold) ★ via Essence Crafting — Wither Essence + coins (wiki Essence Crafting table).
 * Index = number of regular stars applied (0…5). Values are **cumulative** totals.
 *
 * Source: Essence Crafting table (Wither Essence), e.g. Hypixel wiki.
 */
const CUMULATIVE_WITHER_ESSENCE = [0, 150, 450, 950, 1850, 3350] as const;

/** Cumulative coins paid at the blacksmith for star 4–5 steps (per table). */
const CUMULATIVE_STAR_COINS = [0, 0, 0, 0, 10_000, 35_000] as const;

export function cumulativeRegularStarCosts(starCount: number): {
  essence: number;
  coins: number;
} {
  const n = Math.min(Math.max(Math.floor(starCount), 0), 5);
  return {
    essence: CUMULATIVE_WITHER_ESSENCE[n],
    coins: CUMULATIVE_STAR_COINS[n],
  };
}

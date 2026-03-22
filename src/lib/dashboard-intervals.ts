/** Profit targets (coins) — with WIMP scrolls. Defaults: 30M, 40M, 50M. */
export const SCROLLED_PROFIT_INTERVALS = [
  30_000_000, 40_000_000, 50_000_000,
] as const;

/** Profit targets (coins) — no WIMP. Defaults: 15M, 20M, 25M. */
export const NON_SCROLLED_PROFIT_INTERVALS = [
  15_000_000, 20_000_000, 25_000_000,
] as const;

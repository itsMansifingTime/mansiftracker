/** How to price Braided Griffin Feather / Null Blade: bazaar item or craft mats. */
export type TerminatorPartPricing = "bazaar" | "craft";

export type TerminatorCraftOptions = {
  braidedPricing: TerminatorPartPricing;
  nullBladePricing: TerminatorPartPricing;
};

export const DEFAULT_TERMINATOR_CRAFT_OPTIONS: TerminatorCraftOptions = {
  braidedPricing: "craft",
  nullBladePricing: "craft",
};

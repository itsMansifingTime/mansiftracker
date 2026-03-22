import {
  computeCraftCost,
  requiredSellPrice,
  AUCTION_TAX,
} from "./calculator";
import { DEFAULT_CALCULATOR_OPTIONS } from "./calculator-options";
import {
  NON_SCROLLED_PROFIT_INTERVALS,
  SCROLLED_PROFIT_INTERVALS,
} from "./dashboard-intervals";

export type DashboardRow = {
  desiredProfit: number;
  requiredSellPrice: number;
};

export type DashboardSnapshot = {
  scrolled: { craftCost: number; rows: DashboardRow[] };
  nonScrolled: { craftCost: number; rows: DashboardRow[] };
  auctionTaxRate: number;
};

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const base = DEFAULT_CALCULATOR_OPTIONS;
  const scrolledOpts = {
    ...base,
    includeWitherShield: true,
    includeShadowWarp: true,
    includeImplosion: true,
  };
  const nonScrolledOpts = {
    ...base,
    includeWitherShield: false,
    includeShadowWarp: false,
    includeImplosion: false,
  };

  const [scrolledCraft, nonScrolledCraft] = await Promise.all([
    computeCraftCost(scrolledOpts, null),
    computeCraftCost(nonScrolledOpts, null),
  ]);

  const scrolledRows: DashboardRow[] = SCROLLED_PROFIT_INTERVALS.map(
    (desiredProfit) => ({
      desiredProfit,
      requiredSellPrice: Math.ceil(
        requiredSellPrice(scrolledCraft.total, desiredProfit, AUCTION_TAX)
      ),
    })
  );

  const nonScrolledRows: DashboardRow[] = NON_SCROLLED_PROFIT_INTERVALS.map(
    (desiredProfit) => ({
      desiredProfit,
      requiredSellPrice: Math.ceil(
        requiredSellPrice(nonScrolledCraft.total, desiredProfit, AUCTION_TAX)
      ),
    })
  );

  return {
    scrolled: { craftCost: scrolledCraft.total, rows: scrolledRows },
    nonScrolled: { craftCost: nonScrolledCraft.total, rows: nonScrolledRows },
    auctionTaxRate: AUCTION_TAX,
  };
}

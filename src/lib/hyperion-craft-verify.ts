import type { BazaarPriceMode } from "./auction-breakdown";

export type HyperionCraftVerifyRow = {
  auction_id: string;
  starting_bid: number;
  first_seen_at: string;
  item_name: string | null;
  craft_total: number | null;
  margin: number | null;
  bazaar_price_mode: BazaarPriceMode;
  error: string | null;
  notes: string[] | null;
  sections: { id: string; title: string; subtotal: number }[] | null;
};

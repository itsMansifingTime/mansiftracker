import { getCached, setCached } from "./cache";

const BAZAAR_URL = "https://api.hypixel.net/v2/skyblock/bazaar";
const CACHE_MS = 45_000;

export type BazaarSummary = {
  amount: number;
  pricePerUnit: number;
  orders: number;
};

export type BazaarProduct = {
  product_id: string;
  sell_summary: BazaarSummary[];
  buy_summary: BazaarSummary[];
};

export type BazaarResponse = {
  success: boolean;
  lastUpdated?: number;
  products: Record<string, BazaarProduct>;
};

export async function fetchBazaar(): Promise<BazaarResponse> {
  const cached = getCached<BazaarResponse>("bazaar:v2");
  if (cached) return cached;

  const res = await fetch(BAZAAR_URL, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Bazaar HTTP ${res.status}`);
  const data = (await res.json()) as BazaarResponse;
  if (!data.success) throw new Error("Bazaar API returned success: false");
  setCached("bazaar:v2", data, CACHE_MS);
  return data;
}

/** Instant sell to buy orders = buy_summary[0] (per-unit). */
export function bazaarInstantSell(product: BazaarProduct | undefined): number {
  if (!product?.buy_summary?.length) return 0;
  return product.buy_summary[0].pricePerUnit;
}

export function getProduct(
  products: Record<string, BazaarProduct>,
  id: string
): BazaarProduct | undefined {
  return products[id];
}

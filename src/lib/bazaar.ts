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

const FETCH_TIMEOUT_MS = 15_000;

export async function fetchBazaar(): Promise<BazaarResponse> {
  const cached = getCached<BazaarResponse>("bazaar:v2");
  if (cached) return cached;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(BAZAAR_URL, {
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(id);
    if ((e as Error).name === "AbortError") {
      throw new Error("Bazaar request timed out");
    }
    throw e;
  }
  clearTimeout(id);
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

/** Lowest sell order (buy from bazaar) = sell_summary[0] (per-unit). */
export function bazaarSellSummaryFirst(
  product: BazaarProduct | undefined
): number {
  if (!product?.sell_summary?.length) return 0;
  return product.sell_summary[0].pricePerUnit;
}

export function getProduct(
  products: Record<string, BazaarProduct>,
  id: string
): BazaarProduct | undefined {
  return products[id];
}

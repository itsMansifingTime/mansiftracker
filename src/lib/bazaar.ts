import { getCached, setCached } from "./cache";

const BAZAAR_URL = "https://api.hypixel.net/v2/skyblock/bazaar";
const CACHE_MS = 45_000;

export type BazaarSummary = {
  amount: number;
  pricePerUnit: number;
  orders: number;
};

/** Per-product aggregates from Hypixel (`quick_status`). */
export type BazaarQuickStatus = {
  productId: string;
  sellPrice: number;
  sellVolume: number;
  sellMovingWeek: number;
  sellOrders: number;
  buyPrice: number;
  buyVolume: number;
  buyMovingWeek: number;
  buyOrders: number;
};

export type BazaarProduct = {
  product_id: string;
  sell_summary: BazaarSummary[];
  buy_summary: BazaarSummary[];
  quick_status?: BazaarQuickStatus;
};

export type BazaarResponse = {
  success: boolean;
  lastUpdated?: number;
  products: Record<string, BazaarProduct>;
};

const FETCH_TIMEOUT_MS = 25_000;

export async function fetchBazaar(): Promise<BazaarResponse> {
  const cached = getCached<BazaarResponse>("bazaar:v2");
  if (cached) return cached;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(BAZAAR_URL, {
      cache: "no-store",
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

/**
 * Hypixel `buy_summary[0].pricePerUnit` — **instant buy** (what you pay to buy now).
 * Always **≥** {@link bazaarSellSummaryFirst} for the same product when both exist.
 * Legacy name: not “instant sell” — this is **instant buy** pricing.
 */
export function bazaarInstantSell(product: BazaarProduct | undefined): number {
  if (!product?.buy_summary?.length) return 0;
  return product.buy_summary[0].pricePerUnit;
}

/**
 * **Buy-order** price: fill the cheapest sell-to-buyers order (`buy_summary[0]`), or
 * {@link BazaarQuickStatus.buyPrice} when the order book is empty (matches Hypixel quick view).
 */
export function bazaarBuyOrderPrice(product: BazaarProduct | undefined): number {
  if (!product) return 0;
  const first = product.buy_summary?.[0]?.pricePerUnit;
  if (typeof first === "number" && Number.isFinite(first) && first > 0) {
    return first;
  }
  const q = product.quick_status?.buyPrice;
  if (typeof q === "number" && Number.isFinite(q) && q > 0) return q;
  return 0;
}

/**
 * Hypixel `sell_summary[0].pricePerUnit` — **instant sell** (what you receive selling now).
 * Always **≤** {@link bazaarInstantSell} for the same product when both exist.
 */
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

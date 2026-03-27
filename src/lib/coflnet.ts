import { getCached, setCached } from "./cache";

const CACHE_MS = 60_000;

export type CoflBinAuction = {
  startingBid: number;
  tag: string;
  bin?: boolean;
};

export type CoflAuctionEnchant = { type: string; level: number };

export type CoflAuction = {
  uuid: string;
  tag: string;
  itemName: string;
  count: number;
  startingBid: number;
  highestBidAmount?: number;
  bin?: boolean;
  enchantments?: CoflAuctionEnchant[];
  nbtData?: { data?: Record<string, unknown> };
  flatNbt?: Record<string, string | number>;
};

const FETCH_TIMEOUT_MS = 15_000;

export async function fetchLowestJudgementBin(): Promise<number> {
  const cached = getCached<number>("cofl:judgement_bin");
  if (cached !== undefined) return cached;

  const url =
    "https://sky.coflnet.com/api/auctions/tag/JUDGEMENT_CORE/active/bin";
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(id);
    if ((e as Error).name === "AbortError") {
      throw new Error("CoflNet request timed out");
    }
    throw e;
  }
  clearTimeout(id);
  if (!res.ok) throw new Error(`CoflNet HTTP ${res.status}`);
  const list = (await res.json()) as CoflBinAuction[];
  if (!Array.isArray(list) || list.length === 0) {
    setCached("cofl:judgement_bin", 0, CACHE_MS);
    return 0;
  }
  const lowest = Math.min(...list.map((a) => a.startingBid));
  setCached("cofl:judgement_bin", lowest, CACHE_MS);
  return lowest;
}

export async function fetchLowestNecronBin(): Promise<number> {
  const cached = getCached<number>("cofl:necron_bin");
  if (cached !== undefined) return cached;

  const url =
    "https://sky.coflnet.com/api/auctions/tag/NECRON_HANDLE/active/bin";
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(id);
    if ((e as Error).name === "AbortError") {
      throw new Error("CoflNet request timed out");
    }
    throw e;
  }
  clearTimeout(id);
  if (!res.ok) throw new Error(`CoflNet HTTP ${res.status}`);
  const list = (await res.json()) as CoflBinAuction[];
  if (!Array.isArray(list) || list.length === 0) {
    setCached("cofl:necron_bin", 0, CACHE_MS);
    return 0;
  }
  const lowest = Math.min(...list.map((a) => a.startingBid));
  setCached("cofl:necron_bin", lowest, CACHE_MS);
  return lowest;
}

export async function fetchAuctionByUuid(uuid: string): Promise<CoflAuction | null> {
  const clean = uuid.replace(/-/g, "").trim();
  if (!clean || clean.length < 12) return null;
  const url = `https://sky.coflnet.com/api/auction/${clean}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { next: { revalidate: 0 }, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    return (await res.json()) as CoflAuction;
  } catch {
    clearTimeout(id);
    return null;
  }
}

export async function fetchLowestBinByTag(tag: string): Promise<number> {
  const url = `https://sky.coflnet.com/api/auctions/tag/${encodeURIComponent(tag)}/active/bin`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { next: { revalidate: 0 }, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return 0;
    const list = (await res.json()) as CoflBinAuction[];
    if (!Array.isArray(list) || list.length === 0) return 0;
    return Math.min(...list.map((a) => a.startingBid));
  } catch {
    clearTimeout(id);
    return 0;
  }
}

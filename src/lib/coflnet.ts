import { getCached, setCached } from "./cache";

const CACHE_MS = 60_000;

export type CoflBinAuction = {
  startingBid: number;
  tag: string;
  bin?: boolean;
};

export async function fetchLowestNecronBin(): Promise<number> {
  const cached = getCached<number>("cofl:necron_bin");
  if (cached !== undefined) return cached;

  const url =
    "https://sky.coflnet.com/api/auctions/tag/NECRON_HANDLE/active/bin";
  const res = await fetch(url, { next: { revalidate: 0 } });
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

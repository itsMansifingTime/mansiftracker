import { decodeSkyblockItemBytes, normalizeHypixelItemBytesRaw } from "./decode-item-bytes";
import { getExtraAttributesFromFullNbt } from "./item-bytes-modifiers";
import { parseEnchantmentsFromExtraAttributes } from "./extra-enchantments";
import type { CoflAuctionEnchant } from "./coflnet";
import { normalizeUuid } from "./mojang";

const FETCH_MS = 20_000;

export type HypixelDecodedAuctionNbt = {
  mergedExtra: Record<string, unknown>;
  itemId: string | null;
  itemName: string | null;
  enchantments: CoflAuctionEnchant[];
  /** Set when the row came from `hypixel_active_auctions` (paginated AH sync). */
  hypixelListingBin?: boolean;
};

/**
 * Decodes stored Hypixel `item_bytes` (gzip base64 string) into ExtraAttributes
 * for craft breakdown. Shared by API-key single-auction fetch and Supabase AH snapshot.
 */
export async function decodeRawItemBytesToHypixelResult(
  raw: string | null | undefined
): Promise<HypixelDecodedAuctionNbt | null> {
  if (!raw?.trim()) return null;

  const decoded = await decodeSkyblockItemBytes(raw);
  const mergedExtra = getExtraAttributesFromFullNbt(decoded.fullNbt);
  if (!mergedExtra || Object.keys(mergedExtra).length === 0) return null;

  const enchantments = parseEnchantmentsFromExtraAttributes(mergedExtra);
  return {
    mergedExtra,
    itemId: decoded.itemId ?? (typeof mergedExtra.id === "string" ? mergedExtra.id : null),
    itemName: decoded.itemName,
    enchantments,
  };
}

/**
 * Fetches a single auction from Hypixel (requires `HYPIXEL_API_KEY`), decodes
 * `item_bytes` with the same path as track-sales / item_bytes paste.
 * Returns null if no key, HTTP error, or decode produced no ExtraAttributes.
 *
 * Prefer `fetchDecodedAuctionFromSupabaseSnapshot` when the AH has been synced
 * — `/v2/skyblock/auction` rejects requests without `API-Key`.
 */
export async function fetchAndDecodeHypixelAuction(
  auctionUuid: string
): Promise<HypixelDecodedAuctionNbt | null> {
  const key = process.env.HYPIXEL_API_KEY?.trim();
  if (!key) return null;

  const clean = normalizeUuid(auctionUuid);
  if (clean.length < 12) return null;

  const url = `https://api.hypixel.net/v2/skyblock/auction?uuid=${encodeURIComponent(clean)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "API-Key": key },
    });
  } catch {
    clearTimeout(timer);
    return null;
  }
  clearTimeout(timer);
  if (!res.ok) return null;

  const json = (await res.json()) as {
    success?: boolean;
    auction?: { item_bytes?: unknown };
  };
  if (!json.success || !json.auction) return null;

  const raw = normalizeHypixelItemBytesRaw(json.auction.item_bytes);
  return decodeRawItemBytesToHypixelResult(raw);
}

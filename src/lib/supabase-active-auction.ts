import { getSupabaseAdmin } from "./supabase-admin";
import {
  decodeRawItemBytesToHypixelResult,
  type HypixelDecodedAuctionNbt,
} from "./hypixel-auction";
import { normalizeUuid } from "./mojang";

/**
 * Looks up `item_bytes` from the latest Supabase snapshot of the paginated
 * Hypixel active AH (`/v2/skyblock/auctions`, no API key). Populate via
 * `GET /api/sync-active-auctions`.
 */
export async function fetchDecodedAuctionFromSupabaseSnapshot(
  auctionUuid: string
): Promise<HypixelDecodedAuctionNbt | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const clean = normalizeUuid(auctionUuid.trim());
  if (clean.length < 12) return null;

  const { data, error } = await supabase
    .from("hypixel_active_auctions")
    .select("item_bytes, is_bin")
    .eq("auction_id", clean)
    .maybeSingle();

  if (error || !data) return null;
  const decoded = await decodeRawItemBytesToHypixelResult(data.item_bytes);
  if (!decoded) return null;
  return { ...decoded, hypixelListingBin: data.is_bin === true };
}

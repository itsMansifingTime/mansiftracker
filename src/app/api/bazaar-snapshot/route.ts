import { NextResponse } from "next/server";
import { fetchBazaar } from "@/lib/bazaar";

/** Fresh Hypixel data per request — avoids stale cached API responses in production. */
export const dynamic = "force-dynamic";

/**
 * GET /api/bazaar-snapshot — list product ids + lastUpdated (no productId).
 * GET /api/bazaar-snapshot?productId=ENCHANTED_DIAMOND — one product snapshot.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId")?.trim();

    const bazaar = await fetchBazaar();

    if (!productId) {
      const productIds = Object.keys(bazaar.products ?? {}).sort((a, b) =>
        a.localeCompare(b)
      );
      return NextResponse.json({
        lastUpdated: bazaar.lastUpdated ?? null,
        productIds,
      });
    }

    const product = bazaar.products[productId];
    if (!product) {
      return NextResponse.json(
        { error: `Unknown product: ${productId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      lastUpdated: bazaar.lastUpdated ?? null,
      productId,
      product,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bazaar fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

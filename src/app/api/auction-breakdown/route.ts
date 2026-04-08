import { NextResponse } from "next/server";
import { computeAuctionBreakdown } from "@/lib/auction-breakdown";
import { maybeSyncActiveAuctionsBeforeBreakdown } from "@/lib/sync-active-auctions";

export const dynamic = "force-dynamic";
/** Full AH sync before breakdown can exceed default serverless limits. */
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      uuid?: string;
      itemBytesBase64?: string | null;
      bazaarPriceMode?: "instant_buy" | "instant_sell";
    };
    const id = (typeof body.uuid === "string" ? body.uuid : "").trim();
    if (!id) {
      return NextResponse.json(
        { error: "Auction UUID is required" },
        { status: 400 }
      );
    }
    const itemBytesBase64 =
      typeof body.itemBytesBase64 === "string" ? body.itemBytesBase64 : undefined;

    await maybeSyncActiveAuctionsBeforeBreakdown();

    const result = await computeAuctionBreakdown(id, {
      itemBytesBase64,
      bazaarPriceMode: body.bazaarPriceMode,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

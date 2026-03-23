import { NextResponse } from "next/server";
import { computeAuctionBreakdown } from "@/lib/auction-breakdown";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { uuid } = (await req.json()) as { uuid?: string };
    const id = (typeof uuid === "string" ? uuid : "").trim();
    if (!id) {
      return NextResponse.json(
        { error: "Auction UUID is required" },
        { status: 400 }
      );
    }
    const result = await computeAuctionBreakdown(id);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

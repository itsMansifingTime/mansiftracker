import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const BASE_SELECT =
  "auction_id, seller_uuid, seller_profile, buyer_uuid, buyer_profile, price, bin, ended_at, item_id, item_name, item_uuid, minecraft_item_id";

const FULL_SELECT = `${BASE_SELECT}, item_json`;

export async function GET(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured", rows: [] },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const includeFull =
    searchParams.get("full") === "1" ||
    searchParams.get("include") === "item_json";

  const { data, error } = await supabase
    .from("ended_auctions")
    .select(includeFull ? FULL_SELECT : BASE_SELECT)
    .order("ended_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}

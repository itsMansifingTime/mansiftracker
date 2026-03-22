import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured", rows: [] },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("sold_hyperions")
    .select(
      "id, auction_id, seller_name, sold_price, craft_cost_snapshot, over_craft, timestamp"
    )
    .order("timestamp", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}

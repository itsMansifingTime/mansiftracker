import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** Row counts for dashboard (best-effort if a table is missing). */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const tables: { name: string; count: number | null; error?: string }[] = [];

  for (const name of [
    "ended_auctions",
    "sold_hyperions",
    "purchased_hyperions",
  ] as const) {
    const { count, error } = await supabase
      .from(name)
      .select("*", { count: "exact", head: true });
    if (error) {
      tables.push({ name, count: null, error: error.message });
    } else {
      tables.push({ name, count: count ?? 0 });
    }
  }

  return NextResponse.json({ tables });
}

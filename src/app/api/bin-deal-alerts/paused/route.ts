import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET `?secret=` — returns `{ paused: boolean }` for workers using `skipSupabase`
 * (same secret as CRON / test ping).
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const expected =
    process.env.CRON_SECRET?.trim() ??
    process.env.BIN_DEAL_TEST_PING_SECRET?.trim();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ paused: false, note: "supabase_unconfigured" });
  }

  const { data, error } = await supabase
    .from("bin_deal_alert_pause")
    .select("paused")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, paused: false },
      { status: 500 }
    );
  }

  return NextResponse.json({ paused: Boolean(data?.paused) });
}

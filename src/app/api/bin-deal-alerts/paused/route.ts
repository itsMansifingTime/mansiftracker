import { NextResponse } from "next/server";

import { authorizedBinDealPauseReadSecret } from "@/lib/bin-deal-pause";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET `?secret=` — returns `{ paused: boolean }` for workers using `skipSupabase`
 * (any secret that can sign pause links: CRON, test ping, or Discord webhook token).
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!authorizedBinDealPauseReadSecret(secret)) {
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

import { NextResponse } from "next/server";

import {
  verifyDealPauseSignature,
} from "@/lib/bin-deal-pause";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET — opens from Discord link buttons (signed). Sets pause state in Supabase.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const sig = searchParams.get("sig") ?? "";

  if (action !== "pause" && action !== "resume") {
    return new NextResponse("Invalid or missing action (use pause or resume).", {
      status: 400,
    });
  }
  if (!verifyDealPauseSignature(action, sig)) {
    return new NextResponse("Invalid or expired signature.", { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return new NextResponse(
      "Supabase is not configured — cannot save pause state. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and run supabase/bin_deal_alert_pause.sql.",
      { status: 503 }
    );
  }

  const paused = action === "pause";
  const { error } = await supabase.from("bin_deal_alert_pause").upsert(
    {
      id: "default",
      paused,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const title = paused ? "Deal alerts paused" : "Deal alerts resumed";
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${title}</title></head><body style="font-family:system-ui,sans-serif;padding:1.5rem;max-width:32rem"><p><strong>${title}</strong></p><p style="color:#555">You can close this tab.</p></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

import { NextResponse } from "next/server";

import { runBinDealTestPing } from "@/lib/bin-deal-test-ping";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

function authorizeTestPing(req: Request): boolean {
  const expected =
    process.env.BIN_DEAL_TEST_PING_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === expected) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

/**
 * Hourly **test** Discord ping: random allowlisted BIN (starting bid ≥ 50M by default),
 * full craft math, ignores deal margin. Lock down with `BIN_DEAL_TEST_PING_SECRET` or `CRON_SECRET`.
 *
 * Vercel Cron (Pro): `vercel.json` schedules this route. Hobby: use Railway on an interval instead.
 */
export async function GET(req: Request) {
  if (process.env.BIN_DEAL_TEST_PING_ENABLED?.trim() !== "true") {
    return NextResponse.json(
      { error: "Set BIN_DEAL_TEST_PING_ENABLED=true to enable." },
      { status: 403 }
    );
  }

  if (!authorizeTestPing(req)) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. Set BIN_DEAL_TEST_PING_SECRET or CRON_SECRET, then use ?secret=… or Authorization: Bearer …",
      },
      { status: 401 }
    );
  }

  try {
    const result = await runBinDealTestPing();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

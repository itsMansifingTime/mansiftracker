import { NextResponse } from "next/server";
import {
  loadLocalSkinSnapshot,
  reloadOverridesFromStoredSnapshot,
  reloadPricesFromStoredSnapshot,
} from "@/lib/fire-sale-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const reloadPrices = params.get("reloadPrices") === "1";
    const reloadOverrides = params.get("reloadOverrides") === "1";
    const existing = await loadLocalSkinSnapshot();
    const snapshot = reloadOverrides
      ? await reloadOverridesFromStoredSnapshot()
      : reloadPrices
        ? await reloadPricesFromStoredSnapshot()
        : existing ?? { generatedAt: new Date().toISOString(), rows: [] };

    return NextResponse.json({
      ok: true,
      count: snapshot.rows.length,
      generatedAt: snapshot.generatedAt,
      source: reloadOverrides
        ? "overrides_reloaded"
        : reloadPrices
          ? "prices_reloaded"
          : existing
            ? "local_snapshot"
            : "empty_snapshot",
      rows: snapshot.rows,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load fire sale skins";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

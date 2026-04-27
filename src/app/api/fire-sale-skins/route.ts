import { NextResponse } from "next/server";
import {
  buildAndStoreSkinSnapshot,
  loadLocalSkinSnapshot,
} from "@/lib/fire-sale-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  try {
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    const existing = refresh ? null : await loadLocalSkinSnapshot();
    const snapshot = existing ?? (await buildAndStoreSkinSnapshot());

    return NextResponse.json({
      ok: true,
      count: snapshot.rows.length,
      generatedAt: snapshot.generatedAt,
      source: existing ? "local_snapshot" : "fresh_fetch",
      rows: snapshot.rows,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load fire sale skins";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

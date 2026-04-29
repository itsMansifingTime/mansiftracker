import { NextResponse } from "next/server";
import {
  applyOwnershipSnapshotFromUsername,
  listOwnershipSnapshotUsernames,
  loadLocalSkinSnapshot,
  reloadOverridesFromStoredSnapshot,
  reloadPricesFromStoredSnapshot,
  saveOwnershipSnapshotForUsername,
  saveLocalSkinSnapshot,
} from "@/lib/fire-sale-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const reloadPrices = params.get("reloadPrices") === "1";
    const reloadOverrides = params.get("reloadOverrides") === "1";
    const loadUserSnapshot = params.get("loadUserSnapshot") === "1";
    const listUserSnapshots = params.get("listUserSnapshots") === "1";
    const username = params.get("username")?.trim() ?? "";
    if (listUserSnapshots) {
      const usernames = await listOwnershipSnapshotUsernames();
      return NextResponse.json({
        ok: true,
        usernames,
      });
    }
    const existing = await loadLocalSkinSnapshot();
    let snapshot = reloadOverrides
      ? await reloadOverridesFromStoredSnapshot()
      : reloadPrices
        ? await reloadPricesFromStoredSnapshot()
        : existing ?? { generatedAt: new Date().toISOString(), rows: [] };

    if (loadUserSnapshot) {
      if (!username) {
        return NextResponse.json(
          { ok: false, error: "username is required when loadUserSnapshot=1" },
          { status: 400 }
        );
      }
      const applied = await applyOwnershipSnapshotFromUsername(username, snapshot.rows);
      if (!applied) {
        return NextResponse.json(
          { ok: false, error: `No ownership snapshot found for "${username}"` },
          { status: 404 }
        );
      }
      snapshot = {
        generatedAt: new Date().toISOString(),
        rows: applied.rows,
      };
      await saveLocalSkinSnapshot(snapshot);
      return NextResponse.json({
        ok: true,
        count: snapshot.rows.length,
        generatedAt: snapshot.generatedAt,
        source: "user_snapshot_loaded",
        username,
        snapshotSavedAt: applied.savedAt,
        ownedCount: applied.ownedCount,
        rows: snapshot.rows,
      });
    }

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

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      rows?: unknown;
      generatedAt?: string;
      saveUserSnapshot?: boolean;
      username?: string;
    };
    if (body.saveUserSnapshot === true) {
      const username = typeof body.username === "string" ? body.username.trim() : "";
      if (!username) {
        return NextResponse.json(
          { ok: false, error: "username is required to save a user snapshot" },
          { status: 400 }
        );
      }
      if (!Array.isArray(body.rows)) {
        return NextResponse.json(
          { ok: false, error: "rows array is required to save a user snapshot" },
          { status: 400 }
        );
      }
      const saved = await saveOwnershipSnapshotForUsername(username, body.rows);
      return NextResponse.json({
        ok: true,
        username,
        snapshotSavedAt: saved.savedAt,
        ownedCount: saved.ownedCount,
      });
    }

    if (!Array.isArray(body.rows)) {
      return NextResponse.json(
        { ok: false, error: "rows array is required" },
        { status: 400 }
      );
    }

    const snapshot = {
      generatedAt:
        typeof body.generatedAt === "string"
          ? body.generatedAt
          : new Date().toISOString(),
      rows: body.rows,
    };
    await saveLocalSkinSnapshot(snapshot);
    return NextResponse.json({ ok: true, generatedAt: snapshot.generatedAt });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save fire sale snapshot";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

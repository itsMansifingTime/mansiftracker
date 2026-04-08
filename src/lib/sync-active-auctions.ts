import { normalizeHypixelItemBytesRaw } from "./decode-item-bytes";
import { normalizeUuid } from "./mojang";
import { getSupabaseAdmin } from "./supabase-admin";

const MAX_ITEM_BYTES_LEN = 500_000;
const HYPIXEL_AUCTIONS = "https://api.hypixel.net/v2/skyblock/auctions";
const UPSERT_CHUNK = 200;

type ActiveAuction = {
  uuid: string;
  bin?: boolean;
  item_bytes?: unknown;
};

type ActiveAuctionsPage = {
  success: boolean;
  page: number;
  totalPages: number;
  totalAuctions: number;
  auctions?: ActiveAuction[];
};

export type SyncActiveAuctionsResult =
  | {
      ok: true;
      syncRunId: string;
      pagesFetched: number;
      totalPagesAvailable: number;
      activeAuctionsUpserted: number;
    }
  | { ok: false; error: string };

/**
 * Full paginated fetch of Hypixel active AH → `hypixel_active_auctions`.
 * No API key. Used by GET /api/sync-active-auctions and (optionally) craft breakdown.
 */
export async function syncHypixelActiveAuctionsToSupabase(options?: {
  /** Cap pages (e.g. 3 for smoke test). Null = all pages. */
  maxPages?: number | null;
}): Promise<SyncActiveAuctionsResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "Supabase not configured" };
  }

  const maxPages =
    options?.maxPages !== undefined && options?.maxPages !== null
      ? Math.max(1, Math.min(500, options.maxPages))
      : null;

  const firstRes = await fetch(`${HYPIXEL_AUCTIONS}?page=0`, {
    cache: "no-store",
  });
  if (!firstRes.ok) {
    return { ok: false, error: `Hypixel auctions HTTP ${firstRes.status}` };
  }

  const first = (await firstRes.json()) as ActiveAuctionsPage;
  if (!first.success || !first.auctions) {
    return { ok: false, error: "Hypixel auctions invalid response (page 0)" };
  }

  const totalPages = first.totalPages ?? 1;
  const pageLimit =
    maxPages !== null ? Math.min(maxPages, totalPages) : totalPages;

  const allAuctions: ActiveAuction[] = [...first.auctions];

  for (let p = 1; p < pageLimit; p++) {
    const res = await fetch(`${HYPIXEL_AUCTIONS}?page=${p}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Hypixel auctions HTTP ${res.status} (page ${p})`,
      };
    }
    const j = (await res.json()) as ActiveAuctionsPage;
    if (!j.success || !j.auctions) {
      return {
        ok: false,
        error: `Hypixel auctions invalid response (page ${p})`,
      };
    }
    allAuctions.push(...j.auctions);
  }

  const syncRunId = crypto.randomUUID();

  type Row = {
    auction_id: string;
    item_bytes: string | null;
    is_bin: boolean;
    sync_run_id: string;
  };

  const rows: Row[] = [];
  for (const a of allAuctions) {
    const raw = normalizeHypixelItemBytesRaw(a.item_bytes);
    const itemBytes =
      raw && raw.length > MAX_ITEM_BYTES_LEN
        ? raw.slice(0, MAX_ITEM_BYTES_LEN)
        : raw ?? null;
    rows.push({
      auction_id: normalizeUuid(a.uuid),
      item_bytes: itemBytes,
      is_bin: a.bin === true,
      sync_run_id: syncRunId,
    });
  }

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from("hypixel_active_auctions").upsert(chunk, {
      onConflict: "auction_id",
    });
    if (error) {
      return {
        ok: false,
        error: `${error.message} (chunk ${Math.floor(i / UPSERT_CHUNK)})`,
      };
    }
  }

  const { error: delErr } = await supabase
    .from("hypixel_active_auctions")
    .delete()
    .neq("sync_run_id", syncRunId);

  if (delErr) {
    return { ok: false, error: `Cleanup stale rows failed: ${delErr.message}` };
  }

  return {
    ok: true,
    syncRunId,
    pagesFetched: pageLimit,
    totalPagesAvailable: totalPages,
    activeAuctionsUpserted: rows.length,
  };
}

function parseEnvBool(raw: string | undefined, defaultTrue: boolean): boolean {
  if (raw === undefined || raw === "") return defaultTrue;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return defaultTrue;
}

/**
 * Runs before craft breakdown when Supabase is configured (unless disabled).
 * Throttle via `ACTIVE_AUCTIONS_SYNC_MIN_INTERVAL_MS` (default 1 hour; 0 = sync every request).
 */
export async function maybeSyncActiveAuctionsBeforeBreakdown(): Promise<void> {
  if (!parseEnvBool(process.env.ACTIVE_AUCTIONS_SYNC_ON_BREAKDOWN, true)) {
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  /** Default 1h between full scans on craft breakdown; set to 0 to scan every request. */
  const minMs = Math.max(
    0,
    Number.parseInt(
      process.env.ACTIVE_AUCTIONS_SYNC_MIN_INTERVAL_MS ?? String(60 * 60 * 1000),
      10
    ) || 0
  );

  if (minMs > 0) {
    const { data } = await supabase
      .from("hypixel_active_auctions")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const last = data?.synced_at ? new Date(data.synced_at).getTime() : 0;
    if (last > 0 && Date.now() - last < minMs) {
      return;
    }
  }

  const result = await syncHypixelActiveAuctionsToSupabase({ maxPages: null });
  if (!result.ok) {
    console.warn("[maybeSyncActiveAuctionsBeforeBreakdown]", result.error);
  }
}

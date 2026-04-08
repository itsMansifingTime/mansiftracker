import type { SupabaseClient } from "@supabase/supabase-js";

import {
  decodeBinRow,
  fetchAuctionsPage,
  HYPIXEL_AUCTIONS,
  type ActiveAuction,
  type ActiveAuctionsPage,
  type BinRow,
} from "@/lib/track-bin-streaming";

const UPSERT_CHUNK = 200;
const DECODE_PARALLEL = 32;

function isSupabaseMissingTableMessage(msg: string): boolean {
  return /could not find the table|PGRST205|schema cache/i.test(msg);
}

export type FullBinListingsSyncResult = {
  replaceSnapshot: boolean;
  pagesFetched: number;
  totalPagesAvailable: number;
  activeAuctionsScanned: number;
  binAuctionsProcessed: number;
  rowsUpserted: number;
  upsertChunks: number;
  binListingsUpsertSkipped: boolean;
};

/**
 * Fetch every Hypixel active-auctions page, decode BIN rows, upsert into `bin_listings`.
 * When `replaceSnapshot`, deletes all existing rows first (full snapshot replace), then upserts
 * with merge. Otherwise uses `ignoreDuplicates` like incremental scans (first-seen wins).
 * When `skipSupabase`, only fetches + decodes (no DB).
 * When `pagesToFetch` is set, only Hypixel pages `0 … pagesToFetch-1` (capped by API total pages).
 * Pass `firstPage` to avoid an extra fetch of page 0 when the caller already has it.
 */
export async function runFullBinListingsSnapshot(
  supabase: SupabaseClient | null,
  options: {
    replaceSnapshot: boolean;
    skipSupabase?: boolean;
    pagesToFetch?: number;
    firstPage?: ActiveAuctionsPage;
  }
): Promise<
  { ok: true; data: FullBinListingsSyncResult } | { ok: false; error: string }
> {
  const skipDb = options.skipSupabase === true;
  const ignoreDuplicates = !options.replaceSnapshot;

  if (!skipDb && options.replaceSnapshot && supabase) {
    const { error: truncErr } = await supabase.rpc("truncate_bin_listings");
    if (truncErr) {
      if (isSupabaseMissingTableMessage(truncErr.message)) {
        return {
          ok: false,
          error:
            "bin_listings table missing — run supabase/add_bin_listings.sql or schema.sql.",
        };
      }
      if (
        /truncate_bin_listings|function.*does not exist|42883/i.test(
          truncErr.message
        )
      ) {
        return {
          ok: false,
          error:
            "Run supabase/truncate_bin_listings_fn.sql in the Supabase SQL editor (TRUNCATE via RPC avoids DELETE timeouts on large tables).",
        };
      }
      return { ok: false, error: `Clear bin_listings: ${truncErr.message}` };
    }
  }

  let first: ActiveAuctionsPage;
  if (options.firstPage?.success && options.firstPage.auctions) {
    first = options.firstPage;
  } else {
    const firstRes = await fetch(`${HYPIXEL_AUCTIONS}?page=0`, {
      cache: "no-store",
    });
    if (!firstRes.ok) {
      return {
        ok: false,
        error: `Hypixel auctions HTTP ${firstRes.status} (page 0)`,
      };
    }
    first = (await firstRes.json()) as ActiveAuctionsPage;
    if (!first.success || !first.auctions) {
      return { ok: false, error: "Hypixel auctions invalid response (page 0)" };
    }
  }

  const totalPages = first.totalPages ?? 1;
  const pageLimit = Math.min(
    options.pagesToFetch != null
      ? Math.max(1, options.pagesToFetch)
      : totalPages,
    totalPages
  );

  const allAuctions: ActiveAuction[] = [...(first.auctions ?? [])];

  for (let p = 1; p < pageLimit; p++) {
    const got = await fetchAuctionsPage(p);
    if (!got.ok) {
      return { ok: false, error: got.error };
    }
    allAuctions.push(...(got.data.auctions ?? []));
  }

  const binOnly = allAuctions.filter((a) => a.bin === true);
  const firstSeenAt = new Date().toISOString();

  const rows: BinRow[] = [];

  for (let i = 0; i < binOnly.length; i += DECODE_PARALLEL) {
    const slice = binOnly.slice(i, i + DECODE_PARALLEL);
    const batch = await Promise.all(
      slice.map(async (a): Promise<BinRow> => decodeBinRow(a, firstSeenAt))
    );
    rows.push(...batch);
  }

  let binListingsUpsertSkipped = false;
  let rowsUpserted = 0;

  if (!skipDb && supabase) {
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
      const { error } = await supabase.from("bin_listings").upsert(chunk, {
        onConflict: "auction_id",
        ignoreDuplicates,
      });
      if (error) {
        if (isSupabaseMissingTableMessage(error.message)) {
          binListingsUpsertSkipped = true;
          break;
        }
        return {
          ok: false,
          error: `${error.message} (chunk ${Math.floor(i / UPSERT_CHUNK)})`,
        };
      }
      rowsUpserted += chunk.length;
    }
  }

  return {
    ok: true,
    data: {
      replaceSnapshot: options.replaceSnapshot && !skipDb,
      pagesFetched: pageLimit,
      totalPagesAvailable: totalPages,
      activeAuctionsScanned: allAuctions.length,
      binAuctionsProcessed: binOnly.length,
      rowsUpserted,
      upsertChunks: Math.ceil(rows.length / UPSERT_CHUNK) || 0,
      binListingsUpsertSkipped,
    },
  };
}

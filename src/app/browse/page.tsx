"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { BrowseFilterBar } from "@/components/BrowseFilterBar";
import { Nav } from "@/components/Nav";
import {
  type ActiveBrowseFilter,
  serializeBrowseFiltersForApi,
} from "@/lib/browse-filters";
import { formatCoins } from "@/lib/format";

type BrowseRow = {
  auction_id: string;
  seller_uuid: string;
  seller_profile: string | null;
  buyer_uuid: string | null;
  buyer_profile: string | null;
  price: number;
  bin: boolean;
  ended_at: string;
  item_id: string | null;
  item_name: string | null;
  item_uuid: string | null;
  minecraft_item_id: number | null;
};

type DetailRow = BrowseRow & { item_json: unknown };

type TableStat = { name: string; count: number | null; error?: string };

function shortId(s: string | null | undefined, len = 8): string {
  if (!s) return "—";
  const c = s.replace(/-/g, "");
  return c.length <= len ? c : `${c.slice(0, len)}…`;
}

function coflAuctionUrl(auctionId: string): string {
  return `https://sky.coflnet.com/auction/${encodeURIComponent(auctionId)}`;
}

export default function BrowsePage() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<ActiveBrowseFilter[]>([]);
  const [filtersDebounced, setFiltersDebounced] = useState<ActiveBrowseFilter[]>(
    []
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [rows, setRows] = useState<BrowseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tableStats, setTableStats] = useState<TableStat[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 400);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      setFiltersDebounced((prev) => {
        if (
          serializeBrowseFiltersForApi(prev) ===
          serializeBrowseFiltersForApi(filters)
        ) {
          return prev;
        }
        return filters;
      });
    }, 400);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [q, filtersDebounced]);

  const loadBrowse = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (q.trim()) params.set("q", q.trim());
      const filtersPayload = serializeBrowseFiltersForApi(filtersDebounced);
      if (filtersPayload !== "[]") params.set("filters", filtersPayload);
      const res = await fetch(`/api/browse?${params}`);
      const j = await res.json();
      if (!res.ok) {
        const msg = String(j.error ?? res.statusText);
        const hint =
          typeof j.hint === "string" && j.hint.trim()
            ? `\n\n${j.hint.trim()}`
            : "";
        throw new Error(msg + hint);
      }
      setRows(j.rows ?? []);
      setTotal(j.total ?? 0);
      setTotalPages(j.totalPages ?? 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, filtersDebounced]);

  useEffect(() => {
    loadBrowse();
  }, [loadBrowse]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/browse/stats");
        const j = await res.json();
        if (!res.ok || cancelled) return;
        setTableStats(j.tables ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openDetail(auctionId: string) {
    if (expanded === auctionId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(auctionId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(
        `/api/browse?auctionId=${encodeURIComponent(auctionId)}`
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setDetail(j.row as DetailRow);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Database browser
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Search <code className="rounded bg-zinc-800 px-1 text-xs">ended_auctions</code>{" "}
            by text, optional structured filters (rarity, enchants, stars, BIN, sold,
            min price), and expand a row for full{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">item_json</code> (decoded
            NBT).
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
            <h2 className="font-medium text-zinc-300">Tables</h2>
            <ul className="mt-3 space-y-2 text-zinc-500">
              {tableStats?.map((t) => (
                <li key={t.name}>
                  <span className="font-mono text-xs text-sky-400/90">{t.name}</span>
                  {t.error ? (
                    <span className="ml-2 text-xs text-amber-500">({t.error})</span>
                  ) : (
                    <span className="ml-2 font-mono text-zinc-400">
                      {t.count?.toLocaleString() ?? "—"} rows
                    </span>
                  )}
                </li>
              ))}
              {!tableStats && (
                <li className="text-xs text-zinc-600">Loading counts…</li>
              )}
            </ul>
            <div className="mt-4 border-t border-zinc-800 pt-4 text-xs text-zinc-600">
              <p className="font-medium text-zinc-500">ended_auctions columns</p>
              <ul className="mt-2 list-inside list-disc space-y-0.5">
                <li>auction_id, price, bin, ended_at</li>
                <li>seller/buyer UUID + profile</li>
                <li>item_id, item_name, item_uuid, minecraft_item_id</li>
                <li>item_json (full NBT tree), item_bytes (raw)</li>
                <li>
                  <code className="text-zinc-500">item_rarity</code> is derived from
                  NBT (and § codes in <code className="text-zinc-500">display.Name</code>
                  when Hypixel omits <code className="text-zinc-500">ExtraAttributes.rarity</code>
                  ). If rarity filter always returns 0 rows, run{" "}
                  <code className="text-zinc-500">supabase/recreate_item_rarity.sql</code>{" "}
                  once in the SQL editor.
                </li>
              </ul>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className="text-sm font-medium text-zinc-300">
                    Search
                  </label>
                  <input
                    type="search"
                    placeholder="Name, id, rarity tier, auction id, UUID…"
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Per page</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-sky-500 sm:w-28"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => loadBrowse()}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600"
                >
                  Refresh
                </button>
              </div>
              <BrowseFilterBar filters={filters} onFiltersChange={setFilters} />
            </div>

            {err && (
              <div className="whitespace-pre-wrap rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">
                {err}
              </div>
            )}

            <p className="text-xs text-zinc-500">
              {loading
                ? "Loading…"
                : `${total.toLocaleString()} result${total === 1 ? "" : "s"} · page ${page} of ${totalPages}`}
            </p>

            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-3 py-2 font-medium">Ended</th>
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium">SkyBlock id</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="px-3 py-2 font-medium">BIN</th>
                      <th className="px-3 py-2 font-medium">Seller</th>
                      <th className="px-3 py-2 font-medium">Buyer</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading && rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-8 text-center text-zinc-500"
                        >
                          Loading…
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-8 text-center text-zinc-500"
                        >
                          No rows. Run the tracker or widen your search.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <Fragment key={r.auction_id}>
                          <tr
                            className="border-b border-zinc-800/80 bg-zinc-950/20 hover:bg-zinc-800/30"
                          >
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-400">
                              {new Date(r.ended_at).toLocaleString()}
                            </td>
                            <td className="max-w-[180px] truncate px-3 py-2 text-zinc-200">
                              <a
                                href={coflAuctionUrl(r.auction_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400 hover:underline"
                                title={`Open on CoflNet · ${r.item_name ?? r.auction_id}`}
                              >
                                {r.item_name ?? "—"}
                              </a>
                            </td>
                            <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs">
                              <a
                                href={coflAuctionUrl(r.auction_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-500 hover:text-sky-400 hover:underline"
                                title={r.item_id ?? "Open on CoflNet"}
                              >
                                {r.item_id ?? "—"}
                              </a>
                            </td>
                            <td className="px-3 py-2 font-mono text-zinc-200">
                              {formatCoins(r.price)}
                            </td>
                            <td className="px-3 py-2 text-zinc-400">
                              {r.bin ? "Yes" : "No"}
                            </td>
                            <td
                              className="max-w-[100px] truncate px-3 py-2 font-mono text-xs text-zinc-500"
                              title={r.seller_uuid}
                            >
                              {shortId(r.seller_uuid)}
                            </td>
                            <td
                              className="max-w-[100px] truncate px-3 py-2 font-mono text-xs text-zinc-500"
                              title={r.buyer_uuid ?? ""}
                            >
                              {shortId(r.buyer_uuid)}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => openDetail(r.auction_id)}
                                className="text-sky-400 hover:underline"
                              >
                                {expanded === r.auction_id ? "Hide" : "JSON"}
                              </button>
                            </td>
                          </tr>
                          {expanded === r.auction_id && (
                            <tr
                              className="border-b border-zinc-800 bg-zinc-900/80"
                            >
                              <td colSpan={8} className="px-3 py-3">
                                {detailLoading && (
                                  <p className="text-xs text-zinc-500">
                                    Loading item_json…
                                  </p>
                                )}
                                {!detailLoading && detail?.item_json != null && (
                                  <pre className="max-h-[min(70vh,560px)] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                                    {JSON.stringify(detail.item_json, null, 2)}
                                  </pre>
                                )}
                                {!detailLoading &&
                                  detail &&
                                  detail.item_json == null && (
                                    <p className="text-xs text-zinc-500">
                                      No item_json stored for this row.
                                    </p>
                                  )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-500">
                  Page {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { formatCoins } from "@/lib/format";
import type { HyperionCraftVerifyRow } from "@/lib/hyperion-craft-verify";

function shortId(s: string, len = 8): string {
  const c = s.replace(/-/g, "");
  return c.length <= len ? c : `${c.slice(0, len)}…`;
}

function coflAuctionUrl(auctionId: string): string {
  return `https://sky.coflnet.com/auction/${encodeURIComponent(auctionId)}`;
}

export default function HyperionBinVerifyPage() {
  const [limit, setLimit] = useState(25);
  const [bazaarMode, setBazaarMode] = useState<"instant_buy" | "instant_sell">(
    "instant_sell"
  );
  const [rows, setRows] = useState<HyperionCraftVerifyRow[]>([]);
  const [totalMatching, setTotalMatching] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({
        limit: String(limit),
        offset: "0",
        bazaarMode,
      });
      const res = await fetch(`/api/bin-listings/hyperion-crafts?${q}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        error?: string;
        rows?: HyperionCraftVerifyRow[];
        totalMatching?: number;
      };
      if (!res.ok) {
        setErr(json.error ?? `HTTP ${res.status}`);
        setRows([]);
        setTotalMatching(null);
        return;
      }
      setRows(json.rows ?? []);
      setTotalMatching(json.totalMatching ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setRows([]);
      setTotalMatching(null);
    } finally {
      setLoading(false);
    }
  }, [limit, bazaarMode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Hyperion BIN — craft verification
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Reads recent <code className="rounded bg-zinc-800 px-1 text-xs">HYPERION</code>{" "}
            rows from <code className="rounded bg-zinc-800 px-1 text-xs">bin_listings</code>{" "}
            (first-seen log from BIN SNIPER / track pipeline) and recomputes craft cost with the same
            breakdown logic as deal alerts — including listings that never triggered Discord.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Rows</span>
            <select
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Bazaar (material lines)</span>
            <select
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={bazaarMode}
              onChange={(e) =>
                setBazaarMode(e.target.value as "instant_buy" | "instant_sell")
              }
            >
              <option value="instant_buy">Instant buy (buy_summary)</option>
              <option value="instant_sell">Instant sell (sell_summary)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-sky-700/50 bg-sky-950/40 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-950/70 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {err && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {totalMatching !== null && (
          <p className="text-xs text-zinc-500">
            HYPERION rows in DB (matching filter): {totalMatching.toLocaleString("en-US")}
            {rows.length < totalMatching
              ? ` — showing ${rows.length} in this page window`
              : null}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2">First seen</th>
                <th className="px-3 py-2">Auction</th>
                <th className="px-3 py-2 text-right">BIN</th>
                <th className="px-3 py-2 text-right">Craft (est.)</th>
                <th className="px-3 py-2 text-right">Margin</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                    No HYPERION rows in bin_listings yet. Run tracking / BIN SNIPER (
                    <code className="rounded bg-zinc-800 px-1">npm run track:bin</code>
                    ).
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const open = expanded === r.auction_id;
                  return (
                    <Fragment key={r.auction_id}>
                      <tr
                        className="border-b border-zinc-800/80 hover:bg-zinc-900/40"
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-400">
                          {new Date(r.first_seen_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={coflAuctionUrl(r.auction_id)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-sky-400 hover:underline"
                          >
                            {shortId(r.auction_id, 12)}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatCoins(r.starting_bid)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-200">
                          {r.craft_total != null ? formatCoins(r.craft_total) : "—"}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono tabular-nums ${
                            r.margin != null && r.margin > 0
                              ? "text-emerald-400"
                              : r.margin != null && r.margin < 0
                                ? "text-rose-400"
                                : "text-zinc-400"
                          }`}
                        >
                          {r.margin != null ? formatCoins(r.margin) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {r.error ? (
                            <span className="text-xs text-rose-400" title={r.error}>
                              {r.error.slice(0, 48)}
                              {r.error.length > 48 ? "…" : ""}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded(open ? null : r.auction_id)
                              }
                              className="text-xs text-sky-400 hover:underline"
                            >
                              {open ? "Hide" : "Sections"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {open && r.sections && r.sections.length > 0 && (
                        <tr
                          key={`${r.auction_id}-detail`}
                          className="border-b border-zinc-800 bg-zinc-900/30"
                        >
                          <td colSpan={6} className="px-3 py-3">
                            <div className="mb-2 text-xs font-medium text-zinc-500">
                              {r.item_name ?? "Hyperion"} — {r.bazaar_price_mode}
                            </div>
                            <ul className="grid gap-1 font-mono text-xs text-zinc-400 sm:grid-cols-2">
                              {r.sections.map((s) => (
                                <li
                                  key={s.id}
                                  className="flex justify-between gap-4 border-b border-zinc-800/50 py-1"
                                >
                                  <span className="text-zinc-500">{s.title}</span>
                                  <span className="tabular-nums text-zinc-300">
                                    {formatCoins(s.subtotal)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {r.notes && r.notes.length > 0 && (
                              <ul className="mt-2 list-inside list-disc text-xs text-amber-200/90">
                                {r.notes.map((n, i) => (
                                  <li key={i}>{n}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

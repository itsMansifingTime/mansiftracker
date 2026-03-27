"use client";

import { useEffect, useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { formatCoins } from "@/lib/format";

/** 5s = ~12 req/min, better coverage for Hypixel's ~60s auction window. */
const CONTINUOUS_INTERVAL_MS = 5_000;

function shortId(s: string | null | undefined, len = 8): string {
  if (!s) return "—";
  const c = s.replace(/-/g, "");
  return c.length <= len ? c : `${c.slice(0, len)}…`;
}

type EndedRow = {
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

type SoldRow = {
  id: string;
  auction_id: string;
  seller_name: string;
  sold_price: number;
  craft_cost_snapshot: number;
  over_craft: number;
  timestamp: string;
};

type PurchaseRow = {
  id: string;
  auction_id: string;
  buyer_name: string;
  bought_price: number;
  craft_cost_snapshot: number;
  over_craft: number;
  seller_name: string | null;
  timestamp: string;
};

type Tab = "all" | "sold" | "mansif";

export default function TrackerPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [username, setUsername] = useState("Mansif");
  const [endedRows, setEndedRows] = useState<EndedRow[]>([]);
  const [soldRows, setSoldRows] = useState<SoldRow[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);
  const [continuous, setContinuous] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadSales() {
    setLoading(true);
    setErr(null);
    try {
      const [endedRes, salesRes, purchasesRes] = await Promise.all([
        fetch("/api/ended-auctions"),
        fetch("/api/sales"),
        fetch("/api/purchases"),
      ]);
      const endedJ = await endedRes.json();
      const salesJ = await salesRes.json();
      const purchasesJ = await purchasesRes.json();
      if (!endedRes.ok) throw new Error(endedJ.error || endedRes.statusText);
      if (!salesRes.ok) throw new Error(salesJ.error || salesRes.statusText);
      if (!purchasesRes.ok)
        throw new Error(purchasesJ.error || purchasesRes.statusText);
      setEndedRows(endedJ.rows ?? []);
      setSoldRows(salesJ.rows ?? []);
      setPurchaseRows(purchasesJ.rows ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setEndedRows([]);
      setSoldRows([]);
      setPurchaseRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSales();
  }, []);

  const filteredSoldRows = soldRows.filter(
    (r) =>
      r.seller_name.toLowerCase() ===
      (username.trim() || "Mansif").toLowerCase()
  );

  async function triggerTrack() {
    try {
      const res = await fetch("/api/track-sales");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setTrackMsg(
        `Snapshot: ${j.scanned ?? 0} ended auctions — ${j.inserted ?? 0} new, ${j.skippedDuplicates ?? 0} already logged.`
      );
      await loadSales();
    } catch (e) {
      setTrackMsg(e instanceof Error ? e.message : "Track failed");
    }
  }

  function startContinuous() {
    setContinuous(true);
    setTrackMsg(null);
  }

  function stopContinuous() {
    setContinuous(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    if (!continuous) return;
    const run = () => triggerTrack();
    run();
    intervalRef.current = setInterval(run, CONTINUOUS_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [continuous]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Ended auction log
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Each poll calls Hypixel{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              auctions_ended
            </code>{" "}
            and stores <strong className="text-zinc-400">every</strong> auction in
            that snapshot. Hypixel only returns a rolling window (~60s)—poll
            often (e.g. continuous mode) so fewer sales slip between requests.
            This is not a full listing feed; there is no public API for “every
            listing” historically.
          </p>
        </div>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-zinc-300">
                Filter (Hyperion sold tab only)
              </label>
              <input
                className="mt-1 w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Seller name"
              />
            </div>
            {continuous ? (
              <button
                type="button"
                onClick={stopContinuous}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Stop continuous
              </button>
            ) : (
              <button
                type="button"
                onClick={startContinuous}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Start continuous
              </button>
            )}
            <button
              type="button"
              onClick={triggerTrack}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Run track once
            </button>
            <button
              type="button"
              onClick={loadSales}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-700"
            >
              Refresh table
            </button>
          </div>
          {trackMsg && (
            <p className="mt-3 text-sm text-zinc-400">{trackMsg}</p>
          )}
          {continuous && (
            <p className="mt-2 text-xs text-emerald-400/80">
              Polling every {CONTINUOUS_INTERVAL_MS / 1000}s — keep this tab open.
            </p>
          )}
        </section>

        <div className="flex flex-wrap gap-1 border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "all"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            All ended
          </button>
          <button
            type="button"
            onClick={() => setTab("sold")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "sold"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Hyperion sold (legacy)
          </button>
          <button
            type="button"
            onClick={() => setTab("mansif")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "mansif"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Mansif purchases (legacy)
          </button>
        </div>

        {err && (
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            {err}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-medium text-zinc-300">
              {tab === "all"
                ? "All logged ended auctions (newest first)"
                : tab === "sold"
                  ? "Hyperion sold log (legacy)"
                  : "Mansif purchases (legacy)"}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {tab === "all" ? (
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="px-4 py-3 font-medium">Ended</th>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">SkyBlock id</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">BIN</th>
                    <th className="px-4 py-3 font-medium">Seller</th>
                    <th className="px-4 py-3 font-medium">Buyer</th>
                    <th className="px-4 py-3 font-medium">Auction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-zinc-500"
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : endedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-zinc-500"
                      >
                        No rows yet. Run track and ensure the ended_auctions table
                        exists in Supabase.
                      </td>
                    </tr>
                  ) : (
                    endedRows.map((r) => (
                      <tr
                        key={r.auction_id}
                        className="border-b border-zinc-800/80 bg-zinc-950/20 hover:bg-zinc-800/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400 whitespace-nowrap">
                          {new Date(r.ended_at).toLocaleString()}
                        </td>
                        <td
                          className="max-w-[200px] truncate px-4 py-3 text-zinc-300"
                          title={r.item_name ?? ""}
                        >
                          {r.item_name ?? "—"}
                        </td>
                        <td
                          className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-zinc-500"
                          title={r.item_id ?? ""}
                        >
                          {r.item_id ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-200">
                          {formatCoins(r.price)}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {r.bin ? "Yes" : "No"}
                        </td>
                        <td
                          className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-zinc-500"
                          title={r.seller_uuid}
                        >
                          {shortId(r.seller_uuid)}
                        </td>
                        <td
                          className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-zinc-500"
                          title={r.buyer_uuid ?? ""}
                        >
                          {shortId(r.buyer_uuid)}
                        </td>
                        <td
                          className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-zinc-500"
                          title={r.auction_id}
                        >
                          {shortId(r.auction_id, 12)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">
                      {tab === "sold" ? "Sold price" : "Bought price"}
                    </th>
                    <th className="px-4 py-3 font-medium">Craft snapshot</th>
                    <th className="px-4 py-3 font-medium">Over craft</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-zinc-500"
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : tab === "sold" ? (
                    filteredSoldRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-zinc-500"
                        >
                          {soldRows.length === 0
                            ? "Legacy table empty — was populated by the old Hyperion-only tracker."
                            : "No rows for this seller."}
                        </td>
                      </tr>
                    ) : (
                      filteredSoldRows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-zinc-800/80 bg-zinc-950/20 hover:bg-zinc-800/30"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                            {new Date(r.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-200">
                            {formatCoins(r.sold_price)}
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-400">
                            {formatCoins(r.craft_cost_snapshot)}
                          </td>
                          <td
                            className={`px-4 py-3 font-mono ${
                              r.over_craft >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {formatCoins(r.over_craft)}
                          </td>
                        </tr>
                      ))
                    )
                  ) : purchaseRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-zinc-500"
                      >
                        No legacy Mansif purchase rows.
                      </td>
                    </tr>
                  ) : (
                    purchaseRows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-zinc-800/80 bg-zinc-950/20 hover:bg-zinc-800/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                          {new Date(r.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-200">
                          {formatCoins(r.bought_price)}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400">
                          {formatCoins(r.craft_cost_snapshot)}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono ${
                            r.over_craft >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {formatCoins(r.over_craft)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

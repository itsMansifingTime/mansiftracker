"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { formatCoins } from "@/lib/format";

type Row = {
  id: string;
  auction_id: string;
  seller_name: string;
  sold_price: number;
  craft_cost_snapshot: number;
  over_craft: number;
  timestamp: string;
};

export default function TrackerPage() {
  const [username, setUsername] = useState("bowpotato");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);

  async function loadSales() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/sales");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setRows(j.rows ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSales();
  }, []);

  const filteredRows = rows.filter(
    (r) =>
      r.seller_name.toLowerCase() ===
      (username.trim() || "bowpotato").toLowerCase()
  );

  async function triggerTrack() {
    setTrackMsg(null);
    try {
      const res = await fetch(
        `/api/track-sales?username=${encodeURIComponent(username.trim() || "bowpotato")}`
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setTrackMsg(
        `Processed ${j.scanned ?? 0} ended auctions — inserted ${j.inserted ?? 0}, skipped ${j.skippedDuplicates ?? 0} duplicates.`
      );
      await loadSales();
    } catch (e) {
      setTrackMsg(e instanceof Error ? e.message : "Track failed");
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Sold Hyperion tracker
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Hypixel only exposes ended auctions for the last ~60 seconds. With
            the app running locally (
            <code className="rounded bg-zinc-800 px-1 text-xs">npm run dev</code>
            ), use &quot;Run track&quot; here, or in another terminal run{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              npm run track:local
            </code>{" "}
            (optional username:{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              npm run track:local -- name
            </code>
            ). For repeated checks, point Task Scheduler or any cron at that
            command while the dev server stays up.
          </p>
        </div>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-zinc-300">
                Seller username
              </label>
              <input
                className="mt-1 w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={triggerTrack}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Run track (server)
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
        </section>

        {err && (
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            {err}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-medium text-zinc-300">
              Logged sales (newest first)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Sold price</th>
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
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      {rows.length === 0
                        ? "No rows yet. Configure Supabase and run track from the server or cron."
                        : "No sales for this seller in the log yet."}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
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
                          r.over_craft >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatCoins(r.over_craft)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

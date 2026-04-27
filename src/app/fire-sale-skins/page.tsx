"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";

type FireSaleRow = {
  owned: boolean;
  cosmetic: string;
  year: number;
  dateAvailable: string;
  stock: string;
  sheetPrice: number;
  coflTag: string | null;
  monthlyMedian: number | null;
  finalPrice: number;
  priceSource: "cofl_monthly_median" | "sheet";
};

function formatCoins(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export default function FireSaleSkinsPage() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FireSaleRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  async function loadRows(refresh = false) {
    setRunning(true);
    setError(null);
    try {
      const q = refresh ? "?refresh=1" : "";
      const res = await fetch(`/api/fire-sale-skins${q}`, { cache: "no-store" });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        rows?: FireSaleRow[];
        generatedAt?: string;
        source?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setRows(json.rows ?? []);
      setGeneratedAt(json.generatedAt ?? null);
      setSource(json.source ?? null);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Fire Sale skins (PDF converted)
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            First load pulls skins from your local PDF, calls COFL monthly median
            (30-day{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">analysis</code>),
            then stores a local snapshot. Future loads read that snapshot unless
            you force refresh.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void loadRows(false)}
            disabled={running}
            className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Loading…" : "Load local snapshot"}
          </button>
          <button
            type="button"
            onClick={() => void loadRows(true)}
            disabled={running}
            className="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Rebuild from PDF + COFL
          </button>
          {rows.length > 0 ? (
            <span className="text-sm text-zinc-400">{rows.length} rows</span>
          ) : null}
        </div>
        {loaded && generatedAt ? (
          <p className="text-xs text-zinc-500">
            Snapshot: {new Date(generatedAt).toLocaleString()} ({source})
          </p>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loaded && !error && rows.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
            Loaded 0 rows from PDF. Check{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              FIRE_SALES_PDF_PATH
            </code>{" "}
            or PDF formatting.
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="overflow-auto rounded-xl border border-zinc-800">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">Owned</th>
                  <th className="px-3 py-2 text-left">Cosmetic</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Stock</th>
                  <th className="px-3 py-2 text-right">Sheet price</th>
                  <th className="px-3 py-2 text-right">COFL monthly median</th>
                  <th className="px-3 py-2 text-right">Final</th>
                  <th className="px-3 py-2 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.cosmetic}:${r.dateAvailable}`} className="border-t border-zinc-800">
                    <td className="px-3 py-2">{r.owned ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{r.cosmetic}</td>
                    <td className="px-3 py-2">{r.dateAvailable}</td>
                    <td className="px-3 py-2">{r.stock}</td>
                    <td className="px-3 py-2 text-right">{formatCoins(r.sheetPrice)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.monthlyMedian != null ? formatCoins(r.monthlyMedian) : "N/A"}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCoins(r.finalPrice)}</td>
                    <td className="px-3 py-2">
                      {r.priceSource === "cofl_monthly_median" ? "COFL median" : "Sheet fallback"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}

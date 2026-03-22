"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import {
  NON_SCROLLED_PROFIT_INTERVALS,
  SCROLLED_PROFIT_INTERVALS,
} from "@/lib/dashboard-intervals";
import { formatCoins } from "@/lib/format";

type DashboardRow = { desiredProfit: number; requiredSellPrice: number };

type DashboardData = {
  scrolled: { craftCost: number; rows: DashboardRow[] };
  nonScrolled: { craftCost: number; rows: DashboardRow[] };
  auctionTaxRate: number;
};

function ProfitTable({
  title,
  subtitle,
  craftCost,
  rows,
  intervalNote,
}: {
  title: string;
  subtitle: string;
  craftCost: number;
  rows: DashboardRow[];
  intervalNote: string;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
        {title}
      </h2>
      <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
      <p className="mt-2 text-xs text-zinc-500">
        Profit intervals (default):{" "}
        <span className="font-mono text-zinc-400">{intervalNote}</span>
      </p>
      <p className="mt-1 text-sm text-zinc-400">
        Craft cost (this build):{" "}
        <span className="font-mono text-sky-300">{formatCoins(craftCost)}</span>
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[280px] text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th className="pb-2 pr-4">Target profit</th>
              <th className="pb-2">Required BIN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.desiredProfit}
                className="border-b border-zinc-800/80 last:border-0"
              >
                <td className="py-2.5 pr-4 font-mono text-zinc-300">
                  {formatCoins(r.desiredProfit)}
                </td>
                <td className="py-2.5 font-mono text-emerald-400">
                  {formatCoins(r.requiredSellPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setData(j as DashboardData);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scrolledNote = SCROLLED_PROFIT_INTERVALS.map((n) => `${n / 1_000_000}M`).join(
    ", "
  );
  const nonScrolledNote = NON_SCROLLED_PROFIT_INTERVALS.map(
    (n) => `${n / 1_000_000}M`
  ).join(", ");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Profit dashboard
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Required auction BIN at fixed profit targets:{" "}
              <strong className="font-medium text-zinc-400">Scrolled</strong>{" "}
              (WIMP: Wither Shield, Shadow Warp, Implosion) vs{" "}
              <strong className="font-medium text-zinc-400">non-scrolled</strong>{" "}
              (no WIMP). Uses the same defaults as the calculator (stars, gems,
              handle, etc.). Tax {(0.035 * 100).toFixed(1)}%.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-600 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {err && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {loading && !data && !err && (
          <p className="text-sm text-zinc-500">Loading bazaar & BIN data…</p>
        )}

        {data && (
          <div className="grid gap-6 lg:grid-cols-2">
            <ProfitTable
              title="Scrolled profit"
              subtitle="All WIMP scrolls included in craft cost."
              craftCost={data.scrolled.craftCost}
              rows={data.scrolled.rows}
              intervalNote={scrolledNote}
            />
            <ProfitTable
              title="Without scrolls profit"
              subtitle="No WIMP scrolls — lower craft, lower BIN for the same profit target."
              craftCost={data.nonScrolled.craftCost}
              rows={data.nonScrolled.rows}
              intervalNote={nonScrolledNote}
            />
          </div>
        )}

        {data && (
          <p className="text-xs text-zinc-600">
            Formula per row: (craft cost + target profit) ÷ (1 − tax), rounded up.
            Data cached ~45–60s like the calculator.
          </p>
        )}
      </main>
    </div>
  );
}

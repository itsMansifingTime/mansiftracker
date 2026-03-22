"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import {
  DEFAULT_CALCULATOR_OPTIONS,
  type CalculatorOptions,
} from "@/lib/calculator-options";
import { formatCoins } from "@/lib/format";

type ApiResult = {
  lines: { label: string; cost: number }[];
  totalCraftCost: number;
  desiredProfit: number;
  auctionTaxRate: number;
  requiredSellPrice: number;
};

const TOGGLES: { key: keyof CalculatorOptions; label: string }[] = [
  { key: "includeUltimateWise", label: "Ultimate Wise" },
  { key: "includeVampirism", label: "Vampirism" },
  { key: "includeSharpness", label: "Sharpness" },
  { key: "includeExperience", label: "Experience" },
  { key: "includeGiantKiller", label: "Giant Killer" },
  { key: "includeEnderSlayer", label: "Ender Slayer" },
  { key: "includeVenomous", label: "Venomous" },
  { key: "gemsUnlocked", label: "Gems unlocked" },
  { key: "useFlawlessSapphire", label: "Use Flawless Sapphire" },
  { key: "usePerfectSapphire", label: "Use Perfect Sapphire" },
  { key: "includeWitherShield", label: "Wither Shield" },
  { key: "includeShadowWarp", label: "Shadow Warp" },
  { key: "includeImplosion", label: "Implosion" },
];

export default function CalculatorPage() {
  const [opts, setOpts] = useState<CalculatorOptions>(DEFAULT_CALCULATOR_OPTIONS);
  const [profit, setProfit] = useState(50_000_000);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: opts,
          desiredProfit: profit,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setData(j as ApiResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [opts, profit]);

  useEffect(() => {
    run();
  }, [run]);

  function toggle(key: keyof CalculatorOptions) {
    setOpts((o) => ({ ...o, [key]: !o[key] }));
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Hyperion craft calculator
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Bazaar prices use instant sell (buy order top). Handle uses CoflNet
            lowest BIN. Cached ~45–60s on the server.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-medium text-zinc-300">Options</h2>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TOGGLES.map((t) => (
                <label
                  key={t.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-sm hover:border-zinc-700"
                >
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-500 focus:ring-sky-500"
                    checked={opts[t.key]}
                    onChange={() => toggle(t.key)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <div className="mt-6">
              <label className="text-sm font-medium text-zinc-300">
                Desired profit (coins)
              </label>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500"
                value={profit}
                onChange={(e) =>
                  setProfit(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => run()}
                disabled={loading}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {loading ? "…" : "Recalculate"}
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            {err && (
              <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
            )}
            {data && (
              <>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <h2 className="text-sm font-medium text-zinc-300">
                    Component costs
                  </h2>
                  <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
                    {data.lines.map((line) => (
                      <li
                        key={line.label}
                        className="flex justify-between gap-4 border-b border-zinc-800/50 pb-2 last:border-0"
                      >
                        <span className="text-zinc-400">{line.label}</span>
                        <span className="shrink-0 font-mono text-zinc-200">
                          {formatCoins(line.cost)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex justify-between border-t border-zinc-800 pt-3 text-sm font-semibold">
                    <span>Total craft cost</span>
                    <span className="font-mono text-sky-300">
                      {formatCoins(data.totalCraftCost)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <h2 className="text-sm font-medium text-zinc-300">
                    Listing & tax
                  </h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Desired profit</dt>
                      <dd className="font-mono text-zinc-200">
                        {formatCoins(data.desiredProfit)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Auction tax</dt>
                      <dd className="font-mono text-zinc-200">
                        {(data.auctionTaxRate * 100).toFixed(1)}%
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-zinc-800 pt-3 text-base font-semibold">
                      <dt>Required sell price (BIN)</dt>
                      <dd className="font-mono text-emerald-400">
                        {formatCoins(data.requiredSellPrice)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-zinc-500">
                    Formula: (craft + profit) ÷ (1 − 3.5%) — rounded up.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

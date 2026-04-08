"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { HANDLE_DEFAULT_PCT_UNDER_BIN } from "@/lib/calculator-options";
import {
  DEFAULT_TERMINATOR_CRAFT_OPTIONS,
  TERMINATOR_BOW_ENCHANT_ROWS,
  TERMINATOR_ENCHANT_TIER_OPTIONS,
  tierSelectOptions,
  type TerminatorCraftOptions,
  type TerminatorPartPricing,
} from "@/lib/terminator-options";
import { formatCoins, parseCoinShorthand } from "@/lib/format";

type CostSection = {
  id: string;
  title: string;
  lines: { label: string; cost: number }[];
  subtotalLabel: string;
  subtotal: number;
};

type ApiResult = {
  sections: CostSection[];
  totalCraftCost: number;
  desiredProfit: number;
  auctionTaxRate: number;
  requiredSellPrice: number;
  judgementLowestBin: number;
  judgementAutoCoins: number;
};

const selectClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500";

const checkboxClass =
  "rounded border-zinc-600 bg-zinc-900 text-sky-500";

export default function TerminatorPage() {
  const [opts, setOpts] = useState<TerminatorCraftOptions>(
    DEFAULT_TERMINATOR_CRAFT_OPTIONS
  );
  const [judgementInput, setJudgementInput] = useState("");
  const [profitInput, setProfitInput] = useState("35m");
  const [profit, setProfit] = useState(35_000_000);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);

  function patch<K extends keyof TerminatorCraftOptions>(
    key: K,
    value: TerminatorCraftOptions[K]
  ) {
    setOpts((o) => ({ ...o, [key]: value }));
  }

  const profitParsed = parseCoinShorthand(profitInput);
  const profitInvalid =
    profitInput.trim() !== "" && profitParsed === null;

  const judgementTrim = judgementInput.trim();
  const judgementParsed =
    judgementTrim === "" ? null : parseCoinShorthand(judgementTrim);
  const judgementInvalid =
    judgementTrim !== "" && judgementParsed === null;

  useEffect(() => {
    const p = parseCoinShorthand(profitInput);
    if (p !== null) setProfit(Math.max(0, p));
  }, [profitInput]);

  const run = useCallback(async () => {
    if (profitInvalid || judgementInvalid) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/terminator-calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desiredProfit: profit,
          judgementOverrideCoins:
            judgementTrim === "" ? null : judgementParsed,
          ...opts,
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
  }, [
    profit,
    profitInvalid,
    judgementInvalid,
    judgementTrim,
    judgementParsed,
    opts,
  ]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Terminator craft calculator
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Bazaar: instant buy (
            <code className="rounded bg-zinc-800 px-1 text-xs">
              buy_summary[0]
            </code>
            ). Use the dropdowns for Braided Griffin Feather and Null Blade: bazaar
            or craft mats. Judgement Core: CoflNet lowest BIN. Recipe:
            128 Tarantula Silk, 8 Tessellated Ender Pearls, 4 Braided Griffin
            Feathers, 3 Null Blades, 1 Judgement Core. Requires Enderman Slayer 7.
            Dragon Tracer / Gravity are not listed on the Hypixel bazaar API as
            enchant books (add manually if needed).
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <label className="text-sm font-medium text-zinc-300">
                Desired profit (coins)
              </label>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={profitInvalid}
                className={`${selectClass} mt-1 font-mono ${
                  profitInvalid ? "border-red-600 focus:border-red-500" : ""
                }`}
                value={profitInput}
                onChange={(e) => setProfitInput(e.target.value)}
              />
              {profitInvalid && (
                <p className="mt-1 text-xs text-red-400">
                  Unrecognized format — fix the value or use a plain number.
                </p>
              )}
              <button
                type="button"
                onClick={() => run()}
                disabled={loading || profitInvalid || judgementInvalid}
                className="mt-4 w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 sm:w-auto"
              >
                {loading ? "…" : "Recalculate"}
              </button>
            </section>

            <div className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Materials
              </h2>
              <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">
                Braided &amp; Null Blade
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Bazaar: instant buy (
                <code className="rounded bg-zinc-800 px-1 text-[10px]">
                  buy_summary[0]
                </code>
                ). Craft: Griffin + Soul String per braided; Null Ovoid + Enchanted
                Quartz Block + Null Edge per blade.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-zinc-500">
                    Braided Griffin Feather
                  </label>
                  <select
                    className={selectClass}
                    value={opts.braidedPricing}
                    onChange={(e) =>
                      patch(
                        "braidedPricing",
                        e.target.value as TerminatorPartPricing
                      )
                    }
                  >
                    <option value="craft">Craft (mats)</option>
                    <option value="bazaar">Bazaar</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Null Blade</label>
                  <select
                    className={selectClass}
                    value={opts.nullBladePricing}
                    onChange={(e) =>
                      patch(
                        "nullBladePricing",
                        e.target.value as TerminatorPartPricing
                      )
                    }
                  >
                    <option value="craft">Craft (mats)</option>
                    <option value="bazaar">Bazaar</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">
                Judgement Core
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                CoflNet lowest BIN, minus{" "}
                <span className="font-mono text-zinc-400">
                  {HANDLE_DEFAULT_PCT_UNDER_BIN}%
                </span>{" "}
                by default. Leave empty for auto, or override with k/m/b.
              </p>
              <div className="mt-3">
                <label className="text-xs text-zinc-500">
                  Judgement Core (coins, optional override)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Auto"
                  aria-invalid={judgementInvalid}
                  className={`${selectClass} mt-1 font-mono ${
                    judgementInvalid ? "border-red-600 focus:border-red-500" : ""
                  }`}
                  value={judgementInput}
                  onChange={(e) => setJudgementInput(e.target.value)}
                />
                {data && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Lowest BIN:{" "}
                    <span className="font-mono text-zinc-400">
                      {formatCoins(data.judgementLowestBin)}
                    </span>
                    {" · "}Auto (
                    {HANDLE_DEFAULT_PCT_UNDER_BIN}% under):{" "}
                    <span className="font-mono text-zinc-400">
                      {formatCoins(data.judgementAutoCoins)}
                    </span>
                  </p>
                )}
                {judgementInvalid && (
                  <p className="mt-1 text-xs text-red-400">
                    Unrecognized amount — use a number or k/m/b suffixes.
                  </p>
                )}
              </div>
            </section>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Add-ons
              </h2>
              <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">
                Weapon upgrades
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Same items as Hyperion pricing: HPB count, optional Fuming, Recomb,
                and The Art of War (
                <code className="rounded bg-zinc-800 px-1 text-[10px]">
                  THE_ART_OF_WAR
                </code>
                ).
              </p>
              <div className="mt-3">
                <label className="text-xs text-zinc-500">
                  Hot Potato Books (0–10)
                </label>
                <select
                  className={selectClass}
                  value={opts.hotPotatoBooksCount}
                  onChange={(e) =>
                    patch(
                      "hotPotatoBooksCount",
                      Number.parseInt(e.target.value, 10)
                    )
                  }
                >
                  {Array.from({ length: 11 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? "None" : `×${i}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={opts.includeFumingPotatoBook}
                    onChange={() =>
                      patch(
                        "includeFumingPotatoBook",
                        !opts.includeFumingPotatoBook
                      )
                    }
                  />
                  Fuming Potato Book
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={opts.includeRecomb}
                    onChange={() =>
                      patch("includeRecomb", !opts.includeRecomb)
                    }
                  />
                  Recombobulator 3000
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={opts.includeArtOfWar}
                    onChange={() =>
                      patch("includeArtOfWar", !opts.includeArtOfWar)
                    }
                  />
                  The Art of War
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">
                Ultimate &amp; bow enchants
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Ultimates use combinable pricing. Toxophilite only lists level I on
                the bazaar — higher tiers use the same ×2 formula. Other bow books
                use direct{" "}
                <code className="rounded bg-zinc-800 px-1 text-[10px]">
                  ENCHANTMENT_*_N
                </code>{" "}
                prices when listed.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-zinc-500">
                    Ultimate Duplex
                  </label>
                  <select
                    className={selectClass}
                    value={opts.tierDuplex}
                    onChange={(e) =>
                      patch(
                        "tierDuplex",
                        Number.parseInt(e.target.value, 10)
                      )
                    }
                  >
                    {TERMINATOR_ENCHANT_TIER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500">
                    Ultimate Soul Eater
                  </label>
                  <select
                    className={selectClass}
                    value={opts.tierSoulEater}
                    onChange={(e) =>
                      patch(
                        "tierSoulEater",
                        Number.parseInt(e.target.value, 10)
                      )
                    }
                  >
                    {TERMINATOR_ENCHANT_TIER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TERMINATOR_BOW_ENCHANT_ROWS.map((row) => (
                  <div key={row.key}>
                    <label className="text-xs text-zinc-500">{row.label}</label>
                    <select
                      className={selectClass}
                      value={opts[row.key]}
                      onChange={(e) =>
                        patch(
                          row.key,
                          Number.parseInt(e.target.value, 10)
                        )
                      }
                    >
                      {tierSelectOptions(row.maxTier).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>
              </div>
            </div>
          </div>

          <section className="flex flex-col gap-4">
            {loading && !data && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
                Loading prices from Bazaar & CoflNet…
              </div>
            )}
            {err && (
              <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
            )}
            {data && (
              <>
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Total craft cost
                      </span>
                      <span className="font-mono text-lg font-semibold text-sky-300">
                        {formatCoins(data.totalCraftCost)}
                      </span>
                    </div>
                    <div className="hidden h-10 w-px shrink-0 bg-zinc-700 sm:block" />
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Required sell price (BIN)
                      </span>
                      <span className="font-mono text-lg font-semibold text-emerald-400">
                        {formatCoins(data.requiredSellPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex max-h-[min(70vh,720px)] flex-col gap-4 overflow-y-auto pr-1">
                  {data.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
                    >
                      <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
                        {sec.title}
                      </h2>
                      <ul className="mt-3 space-y-2 text-sm">
                        {sec.lines.length === 0 &&
                        sec.id === "terminator-addons" ? (
                          <li className="text-zinc-500">
                            No add-ons in this build.
                          </li>
                        ) : (
                          sec.lines.map((line, idx) => (
                            <li
                              key={`${sec.id}-${idx}-${line.label}`}
                              className="flex justify-between gap-4 border-b border-zinc-800/40 pb-2 last:border-0"
                            >
                              <span className="text-zinc-400">{line.label}</span>
                              <span className="shrink-0 font-mono text-zinc-200">
                                {formatCoins(line.cost)}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                      <div className="mt-3 flex justify-between border-t border-zinc-700 pt-3 text-sm font-semibold text-zinc-100">
                        <span>{sec.subtotalLabel}</span>
                        <span className="font-mono text-sky-300">
                          {formatCoins(sec.subtotal)}
                        </span>
                      </div>
                    </div>
                  ))}
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

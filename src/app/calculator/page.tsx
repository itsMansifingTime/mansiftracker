"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import {
  DEFAULT_CALCULATOR_OPTIONS,
  ENCHANT_DROPDOWNS,
  HANDLE_DEFAULT_PCT_UNDER_BIN,
  SOCKETED_SAPPHIRE_COUNT,
  HOT_POTATO_BOOKS_COUNT,
  type CalculatorOptions,
} from "@/lib/calculator-options";
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
  necronLowestBin: number;
  handleAutoCoins: number;
  gemstoneSlotWiki?: {
    sourceUrl: string;
    snapshotRelativePath: string;
    markdownApiPath: string;
  };
};

const selectClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500";

export default function CalculatorPage() {
  const [opts, setOpts] = useState<CalculatorOptions>(DEFAULT_CALCULATOR_OPTIONS);
  const [handleInput, setHandleInput] = useState("");
  const [profitInput, setProfitInput] = useState("35m");
  const [profit, setProfit] = useState(35_000_000);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);
  const [gemWikiMd, setGemWikiMd] = useState<string | null>(null);
  const [gemWikiErr, setGemWikiErr] = useState<string | null>(null);
  const [gemWikiLoading, setGemWikiLoading] = useState(false);

  const profitParsed = parseCoinShorthand(profitInput);
  const profitInvalid =
    profitInput.trim() !== "" && profitParsed === null;

  const handleTrim = handleInput.trim();
  const handleParsed =
    handleTrim === "" ? null : parseCoinShorthand(handleTrim);
  const handleInvalid = handleTrim !== "" && handleParsed === null;

  useEffect(() => {
    const p = parseCoinShorthand(profitInput);
    if (p !== null) setProfit(Math.max(0, p));
  }, [profitInput]);

  const run = useCallback(async () => {
    if (profitInvalid || handleInvalid) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: opts,
          desiredProfit: profit,
          handleOverrideCoins:
            handleTrim === "" ? null : handleParsed,
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
    opts,
    profit,
    profitInvalid,
    handleInvalid,
    handleTrim,
    handleParsed,
  ]);

  useEffect(() => {
    run();
  }, [run]);

  const loadGemWikiSnapshot = useCallback(async () => {
    if (gemWikiMd !== null || gemWikiLoading) return;
    setGemWikiLoading(true);
    setGemWikiErr(null);
    try {
      const path =
        data?.gemstoneSlotWiki?.markdownApiPath ?? "/api/gemstone-slot-wiki";
      const res = await fetch(path);
      const j = (await res.json()) as { markdown?: string; error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      if (typeof j.markdown !== "string") throw new Error("Invalid response");
      setGemWikiMd(j.markdown);
    } catch (e) {
      setGemWikiErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setGemWikiLoading(false);
    }
  }, [data?.gemstoneSlotWiki?.markdownApiPath, gemWikiMd, gemWikiLoading]);

  function patch<K extends keyof CalculatorOptions>(
    key: K,
    value: CalculatorOptions[K]
  ) {
    setOpts((o) => ({ ...o, [key]: value }));
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
            Bazaar: most lines use{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              buy_summary[0]
            </code>{" "}
            (instant buy, higher). WIMP scrolls: toggle between{" "}
            <strong className="font-medium text-zinc-400">buy order</strong>{" "}
            (<code className="rounded bg-zinc-800 px-1 text-xs">buy_summary</code>{" "}
            + quick_status when empty) and{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              sell_summary[0]
            </code>{" "}
            (instant sell, lower).
            Handle: CoflNet lowest BIN.
            Cached ~45–60s.
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
              <p className="mt-1 text-xs text-zinc-500">
                Use <kbd className="rounded bg-zinc-800 px-1 text-[10px]">k</kbd>
                ,{" "}
                <kbd className="rounded bg-zinc-800 px-1 text-[10px]">m</kbd>
                , or{" "}
                <kbd className="rounded bg-zinc-800 px-1 text-[10px]">b</kbd>{" "}
                for thousands / millions / billions (e.g.{" "}
                <span className="font-mono text-zinc-400">35m</span>,{" "}
                <span className="font-mono text-zinc-400">1.5b</span>). Commas
                are okay.
              </p>
              {profitInvalid && (
                <p className="mt-1 text-xs text-red-400">
                  Unrecognized format — fix the value or use a plain number.
                </p>
              )}
              <button
                type="button"
                onClick={() => run()}
                disabled={loading || profitInvalid || handleInvalid}
                className="mt-4 w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 sm:w-auto"
              >
                {loading ? "…" : "Recalculate"}
              </button>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">Gems</h2>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                  checked={opts.gemSlotsUnlocked}
                  onChange={() => {
                    const next = !opts.gemSlotsUnlocked;
                    setOpts((o) => ({
                      ...o,
                      gemSlotsUnlocked: next,
                      gemSapphire: next ? "perfect" : o.gemSapphire,
                    }));
                  }}
                />
                Slots unlocked
              </label>
              <div className="mt-3 flex flex-wrap gap-4">
                <label
                  className={`flex cursor-pointer items-center gap-2 text-sm ${
                    !opts.gemSlotsUnlocked ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                    checked={opts.gemSapphire === "flawless"}
                    disabled={!opts.gemSlotsUnlocked}
                    onChange={() =>
                      patch(
                        "gemSapphire",
                        opts.gemSapphire === "flawless" ? "none" : "flawless"
                      )
                    }
                  />
                  Flawless (×{SOCKETED_SAPPHIRE_COUNT})
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-2 text-sm ${
                    !opts.gemSlotsUnlocked ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                    checked={opts.gemSapphire === "perfect"}
                    disabled={!opts.gemSlotsUnlocked}
                    onChange={() =>
                      patch(
                        "gemSapphire",
                        opts.gemSapphire === "perfect" ? "none" : "perfect"
                      )
                    }
                  />
                  Perfect (×{SOCKETED_SAPPHIRE_COUNT})
                </label>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                  With slots unlocked, the breakdown includes ✎ and ⚔ unlock
                  (coins + flawless gems per{" "}
                  <a
                    href="https://hypixel-skyblock.fandom.com/wiki/Gemstone_Slot"
                    className="text-sky-400 underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Gemstone Slot
                  </a>
                  ). Flawless/perfect lines price two socketed sapphires (✎ +
                  ⚔, mage build).
              </p>
              <details
                className="mt-3 rounded-lg border border-zinc-700/80 bg-zinc-950/40"
                onToggle={(e) => {
                  if (e.currentTarget.open) void loadGemWikiSnapshot();
                }}
              >
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-300">
                  Local Gemstone Slot wiki snapshot (full page)
                </summary>
                <div className="border-t border-zinc-800 px-3 py-2">
                  <p className="mb-2 text-[11px] text-zinc-500">
                    Markdown saved in-repo for this calculator. For the current
                    live page, use the{" "}
                    <a
                      href="https://hypixel-skyblock.fandom.com/wiki/Gemstone_Slot"
                      className="text-sky-400 underline underline-offset-2"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Fandom wiki
                    </a>
                    .
                  </p>
                  {gemWikiLoading && (
                    <p className="text-xs text-zinc-500">Loading…</p>
                  )}
                  {gemWikiErr && (
                    <p className="text-xs text-red-400">{gemWikiErr}</p>
                  )}
                  {gemWikiMd !== null && (
                    <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-zinc-400">
                      {gemWikiMd}
                    </pre>
                  )}
                </div>
              </details>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">Stars</h2>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm text-zinc-400">
                  <span>Star level (0–10)</span>
                  <span className="font-mono text-sky-300">{opts.starCount}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={opts.starCount}
                  onChange={(e) =>
                    patch("starCount", Number.parseInt(e.target.value, 10))
                  }
                  className="mt-2 w-full accent-sky-500"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  One <strong className="text-zinc-400">Stars (1–10)</strong> line
                  in the breakdown: <strong className="text-zinc-400">1–5</strong>{" "}
                  = regular ★ (wiki essence + coins; Wither at{" "}
                  <code className="rounded bg-zinc-800 px-1 text-[10px]">
                    sell_summary[0]
                  </code>{" "}
                  = instant sell, lower); <strong className="text-zinc-400">6–10</strong> = five regular
                  plus master ★ (
                  <code className="rounded bg-zinc-800 px-1 text-[10px]">
                    buy_summary[0]
                  </code>{" "}
                  on master items).{" "}
                  <strong className="text-zinc-400">0</strong> = off.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">Necron handle</h2>
              <p className="mt-1 text-xs text-zinc-500">
                CoflNet lowest BIN, minus{" "}
                <span className="font-mono text-zinc-400">
                  {HANDLE_DEFAULT_PCT_UNDER_BIN}%
                </span>{" "}
                by default. Leave the field empty to use that auto price, or type
                a coin amount (k/m/b) to override.
              </p>
              <div className="mt-3">
                <label className="text-xs text-zinc-500">
                  Handle (coins, optional override)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Auto"
                  aria-invalid={handleInvalid}
                  className={`${selectClass} mt-1 font-mono ${
                    handleInvalid ? "border-red-600 focus:border-red-500" : ""
                  }`}
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                />
                {data && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Lowest BIN:{" "}
                    <span className="font-mono text-zinc-400">
                      {formatCoins(data.necronLowestBin)}
                    </span>
                    {" · "}Auto handle (
                    {HANDLE_DEFAULT_PCT_UNDER_BIN}% under):{" "}
                    <span className="font-mono text-zinc-400">
                      {formatCoins(data.handleAutoCoins)}
                    </span>
                  </p>
                )}
                {handleInvalid && (
                  <p className="mt-1 text-xs text-red-400">
                    Unrecognized amount — use a number or k/m/b suffixes.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">Extras</h2>
              <div className="mt-3 flex flex-col gap-4">
                <p className="text-xs text-zinc-500">
                  Hot Potato Books: always{" "}
                  <span className="font-mono text-zinc-400">
                    ×{HOT_POTATO_BOOKS_COUNT}
                  </span>{" "}
                  (max) in craft cost.
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
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
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                      checked={opts.includeTitanics}
                      onChange={() =>
                        patch("includeTitanics", !opts.includeTitanics)
                      }
                    />
                    Titanics
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                      checked={opts.includeRecomb}
                      onChange={() =>
                        patch("includeRecomb", !opts.includeRecomb)
                      }
                    />
                    Recomb
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                      checked={opts.includeArtOfWar}
                      onChange={() =>
                        patch("includeArtOfWar", !opts.includeArtOfWar)
                      }
                    />
                    The Art of War
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">Enchants</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Fixed: Ultimate Wise 5, Cleave 5, Critical 6, Cubism 5, Ender
                Slayer 6, Execute 5, Experience 4, Fire Aspect 3, First Strike
                4, Giant Killer 6, Impaling 5, Knockback 2, Lethality 6,
                Looting 4, Luck 6, Scav 5, Sharpness 6, Vampirism 6.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ENCHANT_DROPDOWNS.map((row) => (
                  <div key={row.key}>
                    <label className="text-xs text-zinc-500">{row.label}</label>
                    <select
                      className={selectClass}
                      value={opts[row.key] as number}
                      onChange={(e) =>
                        patch(
                          row.key,
                          Number.parseInt(e.target.value, 10) as CalculatorOptions[typeof row.key]
                        )
                      }
                    >
                      {row.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-medium text-zinc-300">WIMP scrolls</h2>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                    checked={opts.includeWitherShield}
                    onChange={() =>
                      patch("includeWitherShield", !opts.includeWitherShield)
                    }
                  />
                  Wither Shield
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                    checked={opts.includeShadowWarp}
                    onChange={() =>
                      patch("includeShadowWarp", !opts.includeShadowWarp)
                    }
                  />
                  Shadow Warp
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                    checked={opts.includeImplosion}
                    onChange={() =>
                      patch("includeImplosion", !opts.includeImplosion)
                    }
                  />
                  Implosion
                </label>
                <span className="ml-2 border-l border-zinc-700 pl-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                      checked={opts.scrollsInstantBuy}
                      onChange={() =>
                        patch("scrollsInstantBuy", !opts.scrollsInstantBuy)
                      }
                    />
                    Instant buy (scrolls)
                  </label>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {opts.scrollsInstantBuy
                      ? "buy_summary[0] — instant buy (higher)"
                      : "sell_summary[0] — instant sell (lower)"}
                  </p>
                </span>
              </div>
            </section>
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
                        {sec.lines.map((line, idx) => (
                          <li
                            key={`${sec.id}-${idx}-${line.label}`}
                            className="flex justify-between gap-4 border-b border-zinc-800/40 pb-2 last:border-0"
                          >
                            <span className="text-zinc-400">{line.label}</span>
                            <span className="shrink-0 font-mono text-zinc-200">
                              {formatCoins(line.cost)}
                            </span>
                          </li>
                        ))}
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

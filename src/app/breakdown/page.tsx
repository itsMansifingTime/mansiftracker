"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import type { BazaarPriceMode } from "@/lib/auction-breakdown";
import { formatCoins } from "@/lib/format";

type BreakdownSection = {
  id: string;
  title: string;
  lines: { label: string; cost: number }[];
  subtotal: number;
};

type Result = {
  auction: { uuid: string; itemName: string; tag: string };
  sections: BreakdownSection[];
  total: number;
  notes?: string[];
  error?: string;
  bazaarPriceMode?: BazaarPriceMode;
};

const selectClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500";

export default function BreakdownPage() {
  const [uuidInput, setUuidInput] = useState("");
  const [itemBytesInput, setItemBytesInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bazaarMode, setBazaarMode] = useState<BazaarPriceMode>("instant_sell");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = uuidInput.trim();
    if (!id) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/auction-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid: id,
          itemBytesBase64: itemBytesInput.trim() || undefined,
          bazaarPriceMode: bazaarMode,
        }),
      });
      const j = (await res.json()) as Result & { error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      if (j.error) {
        setErr(j.error);
        setResult(j);
      } else {
        setResult(j);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Auction craft breakdown
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Paste an auction UUID for a craft cost breakdown. With{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">HYPIXEL_API_KEY</code>{" "}
            set in <code className="rounded bg-zinc-800 px-1 text-xs">.env.local</code>, the
            server fetches the Hypixel auction API and decodes{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">item_bytes</code> locally
            (gzip → NBT), or reads the Supabase AH snapshot (no key; full rescan at most about once
            per hour on breakdown submit, or anytime via{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">GET /api/sync-active-auctions</code>
            ). Otherwise CoflNet listing + NBT is fallback. Kuudra-family
            armor uses Basic-tier BIN + wiki essence path + enchants. Optional: paste raw{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">item_bytes</code> (gzip base64) to
            merge on top when something is still missing.             Toggle <strong className="text-zinc-400">Instant buy</strong> vs{" "}
            <strong className="text-zinc-400">Instant sell</strong> for Hypixel bazaar
            material & enchant lines (default: buy). BIN references from{" "}
            <a
              href="https://sky.coflnet.com"
              className="text-sky-400 underline"
              target="_blank"
              rel="noreferrer"
            >
              CoflNet
            </a>
            .
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-300">
              Auction UUID
            </label>
            <input
              type="text"
              className={selectClass}
              placeholder="e.g. e4a562167ebd4b9e86c7e4b8dcd5fc63"
              value={uuidInput}
              onChange={(e) => setUuidInput(e.target.value)}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Find UUIDs on{" "}
              <a
                href="https://sky.coflnet.com/"
                className="text-sky-400 underline"
                target="_blank"
                rel="noreferrer"
              >
                sky.coflnet.com
              </a>{" "}
              — click an auction, the UUID is in the URL.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300">
              item_bytes (optional)
            </label>
            <textarea
              className="mt-1 w-full min-h-[72px] resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-sky-500"
              placeholder="Paste gzip base64 from auction inspect / API…"
              value={itemBytesInput}
              onChange={(e) => setItemBytesInput(e.target.value)}
              disabled={loading}
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Merged on top of Hypixel decode (with API key) or Cofl NBT for modifiers + Kuudra ★
              detection.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-zinc-400">Bazaar pricing</span>
            <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => setBazaarMode("instant_buy")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  bazaarMode === "instant_buy"
                    ? "bg-sky-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Instant buy
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setBazaarMode("instant_sell")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  bazaarMode === "instant_sell"
                    ? "bg-sky-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Instant sell
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !uuidInput.trim()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? "…" : "Get breakdown"}
          </button>
        </form>

        {err && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {result && !result.error && result.notes && result.notes.length > 0 && (
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/95">
            <ul className="list-inside list-disc space-y-1">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {result && !result.error && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-5">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {result.auction.itemName} ({result.auction.tag})
                </span>
                <span className="font-mono text-lg font-semibold text-sky-300">
                  Total craft cost: {formatCoins(result.total)}
                </span>
                {result.bazaarPriceMode && (
                  <span className="text-xs text-zinc-500">
                    Bazaar:{" "}
                    {result.bazaarPriceMode === "instant_buy"
                      ? "instant buy (buy_summary[0])"
                      : "instant sell (sell_summary[0])"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {result.sections.map((sec) => (
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
                        key={`${sec.id}-${idx}`}
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
                    <span>Subtotal</span>
                    <span className="font-mono text-sky-300">
                      {formatCoins(sec.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

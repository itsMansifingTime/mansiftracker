"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import type { BazaarProduct, BazaarSummary } from "@/lib/bazaar";
import { formatCoins, formatCoinsDetail } from "@/lib/format";

const DEFAULT_PRODUCT = "ENCHANTED_DIAMOND";

type SnapshotPayload = {
  lastUpdated: number | null;
  productId: string;
  product: BazaarProduct;
};

type ListPayload = {
  lastUpdated: number | null;
  productIds: string[];
};

const FETCH_API: RequestInit = { cache: "no-store" };

function friendlyFetchError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    e instanceof TypeError ||
    /failed to fetch|networkerror|load failed/i.test(msg)
  ) {
    return (
      "Could not reach this app’s server (network error). " +
      "Run `npm run dev` and open this page at http://localhost:3000 (same tab). " +
      "If it still fails, try http://127.0.0.1:3000 or disable VPN/ad-block for localhost."
    );
  }
  return msg || "Request failed.";
}

async function readApiJson<T extends object>(
  res: Response
): Promise<T & { error?: string }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 200);
    throw new Error(
      res.ok
        ? `Invalid JSON from /api: ${snippet}`
        : `Server error ${res.status}: ${snippet}`
    );
  }
}

function formatSnapshotHeading(lastUpdated: number | null): string {
  const d =
    lastUpdated != null && Number.isFinite(lastUpdated)
      ? new Date(lastUpdated)
      : new Date();
  return d.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function coinEquivalent(row: BazaarSummary): number {
  return row.amount * row.pricePerUnit;
}

const DEPTH_TINT = {
  sell: "rgba(127, 29, 29, 0.38)",
  buy: "rgba(5, 95, 70, 0.38)",
} as const;

function OrderDepthTable({
  title,
  rows,
  side,
}: {
  title: string;
  rows: BazaarSummary[];
  side: "sell" | "buy";
}) {
  const maxEq = Math.max(1, ...rows.map((r) => coinEquivalent(r)));
  const tint = DEPTH_TINT[side];

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const totalCoinEq = rows.reduce((s, r) => s + coinEquivalent(r), 0);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
        {title}
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        All price levels from the Hypixel API (scroll).
      </p>
      <div className="mt-3 overflow-hidden rounded-md border border-zinc-800/50">
        <div className="max-h-[min(70vh,560px)] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[28rem] table-fixed border-collapse text-sm tabular-nums">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[30%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 text-xs font-medium uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
              <tr>
                <th className="px-2 py-2 text-left">Price per unit</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2 text-right">Orders</th>
                <th className="px-2 py-2 text-right">Coin equivalent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const eq = coinEquivalent(row);
                const pct = (eq / maxEq) * 100;
                return (
                  <tr
                    key={`${row.pricePerUnit}-${row.amount}-${i}`}
                    className="border-b border-zinc-800/30"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${tint} ${pct}%, transparent ${pct}%)`,
                    }}
                  >
                    <td className="px-2 py-1.5 align-middle font-mono text-xs text-zinc-200 sm:text-sm">
                      {formatCoinsDetail(row.pricePerUnit)} Coins
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs text-zinc-200 sm:text-sm">
                      {formatCoins(row.amount)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs text-zinc-200 sm:text-sm">
                      {row.orders}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs text-zinc-100 sm:text-sm">
                      {formatCoinsDetail(eq, 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <table className="w-full min-w-[28rem] table-fixed border-collapse border-t-2 border-zinc-600 bg-zinc-900/98 text-sm tabular-nums">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[30%]" />
            </colgroup>
            <tbody>
              <tr>
                <td className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Total (listed)
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-semibold text-zinc-100">
                  {formatCoins(totalAmount)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-semibold text-zinc-100">
                  {formatCoins(totalOrders)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-semibold text-sky-300">
                  {formatCoinsDetail(totalCoinEq, 1)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {rows.length === 0 && (
        <p className="mt-2 text-sm text-zinc-500">No orders at this level.</p>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  orders,
  price,
  volume,
  weekly,
  weeklyLabel,
}: {
  title: string;
  orders: number;
  price: number;
  volume: number;
  weekly: number;
  weeklyLabel: string;
}) {
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="shrink-0 text-right font-mono text-zinc-100">{value}</span>
    </div>
  );

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
        {title}
      </h2>
      <div className="mt-4 space-y-2">
        {row("Orders", formatCoins(orders))}
        {row("Price", `${formatCoinsDetail(price)} Coins`)}
        {row("Volume", formatCoins(volume))}
        {row(weeklyLabel, `${formatCoins(weekly)} items/week`)}
      </div>
    </div>
  );
}

export default function BazaarSnapshotPage() {
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productIdsRequested, setProductIdsRequested] = useState(false);
  const [productInput, setProductInput] = useState(DEFAULT_PRODUCT);
  const [activeId, setActiveId] = useState(DEFAULT_PRODUCT);
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadProduct = useCallback(async (productId: string) => {
    setLoadingProduct(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/bazaar-snapshot?productId=${encodeURIComponent(productId)}`,
        FETCH_API
      );
      const j = await readApiJson<SnapshotPayload>(res);
      if (!res.ok) throw new Error(j.error || res.statusText);
      setSnapshot(j);
    } catch (e) {
      setErr(friendlyFetchError(e));
      setSnapshot(null);
    } finally {
      setLoadingProduct(false);
    }
  }, []);

  /** Full product-id list is large (~1k+ strings). Load once when the user focuses the field — not on every page visit (saves RAM/CPU vs fetching the list + product up front). */
  const loadProductIdList = useCallback(async () => {
    if (productIdsRequested) return;
    setProductIdsRequested(true);
    try {
      const res = await fetch("/api/bazaar-snapshot", FETCH_API);
      const j = await readApiJson<ListPayload>(res);
      if (!res.ok) throw new Error(j.error || res.statusText);
      setProductIds(j.productIds);
    } catch {
      setProductIdsRequested(false);
    }
  }, [productIdsRequested]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadProduct(DEFAULT_PRODUCT);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProduct]);

  const headingDate = useMemo(() => {
    return formatSnapshotHeading(snapshot?.lastUpdated ?? null);
  }, [snapshot?.lastUpdated]);

  const qs = snapshot?.product.quick_status;

  const instaBuy = useMemo(() => {
    if (!snapshot) return null;
    const p = snapshot.product;
    const first = p.buy_summary[0];
    return {
      orders: qs?.buyOrders ?? 0,
      price: first?.pricePerUnit ?? qs?.buyPrice ?? 0,
      volume: qs?.buyVolume ?? 0,
      weekly: qs?.buyMovingWeek ?? 0,
    };
  }, [snapshot, qs]);

  const instaSell = useMemo(() => {
    if (!snapshot) return null;
    const p = snapshot.product;
    const first = p.sell_summary[0];
    return {
      orders: qs?.sellOrders ?? 0,
      price: first?.pricePerUnit ?? qs?.sellPrice ?? 0,
      volume: qs?.sellVolume ?? 0,
      weekly: qs?.sellMovingWeek ?? 0,
    };
  }, [snapshot, qs]);

  function applyProduct(next: string) {
    const trimmed = next.trim();
    if (!trimmed) {
      setErr("Enter a product id.");
      return;
    }
    if (productIds.length > 0 && !productIds.includes(trimmed)) {
      setErr("Unknown product id — use suggestions or check spelling.");
      return;
    }
    setErr(null);
    setActiveId(trimmed);
    setProductInput(trimmed);
    void loadProduct(trimmed);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
              Bazaar Snapshot ({headingDate})
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Live data from{" "}
              <code className="rounded bg-zinc-800 px-1 text-xs">
                api.hypixel.net/v2/skyblock/bazaar
              </code>
              . Cached ~45s server-side.
            </p>
          </div>
          <div className="flex w-full max-w-md flex-col gap-2 sm:w-auto">
            <label className="text-xs font-medium text-zinc-400">
              Product id
            </label>
            <div className="flex gap-2">
              <input
                className="w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-sky-500/0 transition focus:border-sky-600 focus:ring-2 focus:ring-sky-500/30"
                list="bazaar-product-ids"
                value={productInput}
                onFocus={() => void loadProductIdList()}
                onChange={(e) => setProductInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyProduct(productInput);
                }}
                spellCheck={false}
                autoComplete="off"
                placeholder="e.g. ENCHANTED_DIAMOND"
              />
              <datalist id="bazaar-product-ids">
                {productIds.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={() => applyProduct(productInput)}
                disabled={loading || loadingProduct}
                className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {loadingProduct ? "…" : "Load"}
              </button>
            </div>
            {activeId && (
              <p className="text-xs text-zinc-500">
                Showing{" "}
                <span className="font-mono text-zinc-300">{activeId}</span>
              </p>
            )}
          </div>
        </div>

        {err && (
          <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {loading && !snapshot && (
          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-12 text-center text-sm text-zinc-400">
            Loading bazaar…
          </div>
        )}

        {snapshot && instaBuy && instaSell && (
          <div className="mt-8 flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <SummaryCard
                title="(Insta) Buy information"
                orders={instaBuy.orders}
                price={instaBuy.price}
                volume={instaBuy.volume}
                weekly={instaBuy.weekly}
                weeklyLabel="Average insta-buys"
              />
              <SummaryCard
                title="(Insta) Sell information"
                orders={instaSell.orders}
                price={instaSell.price}
                volume={instaSell.volume}
                weekly={instaSell.weekly}
                weeklyLabel="Average insta-sells"
              />
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              In the depth tables,{" "}
              <span className="text-zinc-400">Amount</span> is how many items sit at
              that price;{" "}
              <span className="text-zinc-400">Orders</span> is how many separate
              player orders (one order can list many items). The top cards&apos;{" "}
              <span className="text-zinc-400">Volume</span> comes from Hypixel{" "}
              <code className="rounded bg-zinc-800 px-1">quick_status</code> (
              <code className="rounded bg-zinc-800 px-1 text-[10px]">buyVolume</code>{" "}
              /{" "}
              <code className="rounded bg-zinc-800 px-1 text-[10px]">sellVolume</code>
              ) — a separate aggregate from the API, so it won&apos;t necessarily
              match the sum of Amount in the book or the Total row.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <OrderDepthTable
                title="Sell orders"
                rows={snapshot.product.buy_summary}
                side="sell"
              />
              <OrderDepthTable
                title="Buy orders"
                rows={snapshot.product.sell_summary}
                side="buy"
              />
            </div>

            <p className="text-xs leading-relaxed text-zinc-500">
              Hypixel names are swapped vs player language:{" "}
              <code className="rounded bg-zinc-800 px-1">buy_summary</code> is
              the side you <span className="text-zinc-400">instant-buy</span>{" "}
              from (listed here as Sell orders).{" "}
              <code className="rounded bg-zinc-800 px-1">sell_summary</code> is
              the side you <span className="text-zinc-400">instant-sell</span>{" "}
              into (Buy orders). See{" "}
              <code className="rounded bg-zinc-800 px-1">bazaar.ts</code> and
              repo rule{" "}
              <code className="rounded bg-zinc-800 px-1">
                hypixel-bazaar-summaries
              </code>
              .
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
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
  finalPrice: number | null;
  priceSource: "manual_override" | "cofl_monthly_median" | "missing";
};

type OwnershipSnapshotUser = {
  username: string;
  savedAt: string;
  ownedCount: number;
};

type SortKey =
  | "owned"
  | "cosmetic"
  | "date"
  | "stock"
  | "sheetPrice"
  | "finalPrice"
  | "marketCap"
  | "coinsPerGem"
  | "priceSource"
  | "skinType";
type SortDirection = "asc" | "desc";

function formatCoins(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) {
    const n = value / 1_000_000_000_000;
    return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)}T`;
  }
  if (abs >= 1_000_000_000) {
    const n = value / 1_000_000_000;
    return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    const n = value / 1_000_000;
    return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)}M`;
  }
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

const PET_NAMES = [
  "allay",
  "ammonite",
  "armadillo",
  "axolotl",
  "baby yeti",
  "bal",
  "bat",
  "bee",
  "bingo",
  "black cat",
  "blaze",
  "blue whale",
  "chicken",
  "crow",
  "cow",
  "dolphin",
  "dragon",
  "elephant",
  "enderman",
  "endermite",
  "eman",
  "flying fish",
  "giraffe",
  "glacite golem",
  "goblin",
  "golden dragon",
  "gorilla",
  "grandma wolf",
  "griffin",
  "guardian",
  "hedgehog",
  "horse",
  "hound",
  "jellyfish",
  "jerry",
  "lion",
  "mammoth",
  "magma cube",
  "megalodon",
  "mithril golem",
  "monkey",
  "mooshroom",
  "ocelot",
  "octopus",
  "owl",
  "parrot",
  "penguin",
  "phoenix",
  "pig",
  "pigman",
  "rabbit",
  "rat",
  "reindeer",
  "rock",
  "rift ferret",
  "scatha",
  "sea horse",
  "sheep",
  "silverfish",
  "skeleton",
  "sloth",
  "snail",
  "snowman",
  "slug",
  "spider",
  "spirit",
  "squid",
  "tarantula",
  "trex",
  "tiger",
  "turtle",
  "wolf",
  "wisp",
  "wither skeleton",
];

function getSkinType(cosmetic: string): "pet" | "armor" | "backpack" {
  const n = cosmetic.toLowerCase();
  if (n.includes("backpack")) return "backpack";
  return PET_NAMES.some((pet) => n.includes(pet)) ? "pet" : "armor";
}

function ToggleSwitch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
        checked ? "bg-sky-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function FireSaleSkinsPage() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FireSaleRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("finalPrice");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showOwned, setShowOwned] = useState(true);
  const [showUnowned, setShowUnowned] = useState(true);
  const [search, setSearch] = useState("");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [showPetSkins, setShowPetSkins] = useState(true);
  const [showArmorSkins, setShowArmorSkins] = useState(true);
  const [showBackpackSkins, setShowBackpackSkins] = useState(true);
  const [username, setUsername] = useState("");
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [savedUsers, setSavedUsers] = useState<OwnershipSnapshotUser[]>([]);

  const availableYears = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a);

  function toggleYear(year: number) {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  }

  async function persistRows(nextRows: FireSaleRow[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/fire-sale-skins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: nextRows,
          generatedAt: generatedAt ?? new Date().toISOString(),
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; generatedAt?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      if (json.generatedAt) setGeneratedAt(json.generatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function toggleOwned(target: FireSaleRow) {
    setRows((prev) => {
      const nextRows = prev.map((row) =>
        row.cosmetic === target.cosmetic && row.dateAvailable === target.dateAvailable
          ? { ...row, owned: !row.owned }
          : row
      );
      void persistRows(nextRows);
      return nextRows;
    });
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection("desc");
      return;
    }
    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
  }

  const baseFilteredRows = rows.filter((r) => {
    const matchesYear = selectedYears.length === 0 || selectedYears.includes(r.year);
    if (!matchesYear) return false;
    const skinType = getSkinType(r.cosmetic);
    const matchesType =
      (skinType === "pet" && showPetSkins) ||
      (skinType === "armor" && showArmorSkins) ||
      (skinType === "backpack" && showBackpackSkins);
    if (!matchesType) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.cosmetic.toLowerCase().includes(q);
  });

  const filteredRows = baseFilteredRows.filter((r) => {
    const matchesOwned = (r.owned && showOwned) || (!r.owned && showUnowned);
    return matchesOwned;
  });

  function getSortValue(row: FireSaleRow, key: SortKey): number | string {
    switch (key) {
      case "owned":
        return row.owned ? 1 : 0;
      case "cosmetic":
        return row.cosmetic.toLowerCase();
      case "date":
        return new Date(row.dateAvailable).getTime();
      case "stock":
        return Number.parseInt(row.stock, 10);
      case "sheetPrice":
        return row.sheetPrice;
      case "finalPrice":
        return row.finalPrice ?? -1;
      case "marketCap": {
        const qty = Number.parseInt(row.stock, 10);
        return row.finalPrice != null && Number.isFinite(qty) ? row.finalPrice * qty : -1;
      }
      case "coinsPerGem":
        return row.finalPrice != null && row.sheetPrice > 0 ? row.finalPrice / row.sheetPrice : -1;
      case "priceSource":
        return row.priceSource;
      case "skinType":
        return getSkinType(row.cosmetic);
      default:
        return 0;
    }
  }

  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    if (typeof av === "string" && typeof bv === "string") {
      const cmp = av.localeCompare(bv);
      return sortDirection === "asc" ? cmp : -cmp;
    }
    const delta = Number(av) - Number(bv);
    return sortDirection === "asc" ? delta : -delta;
  });

  function sortArrowFor(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDirection === "desc" ? "↓" : "↑";
  }

  const ownedRows = filteredRows.filter((r) => r.owned);
  const unownedRows = filteredRows.filter((r) => !r.owned);
  const ownedTotal = ownedRows.reduce((sum, r) => sum + (r.finalPrice ?? 0), 0);
  const unownedTotal = unownedRows.reduce((sum, r) => sum + (r.finalPrice ?? 0), 0);
  const totalMarketCap = baseFilteredRows.reduce((sum, r) => {
    if (r.finalPrice == null) return sum;
    const qty = Number.parseInt(r.stock, 10);
    return Number.isFinite(qty) ? sum + r.finalPrice * qty : sum;
  }, 0);
  const averageCoinsPerGemByYear = Array.from(new Set(filteredRows.map((r) => r.year)))
    .sort((a, b) => b - a)
    .map((year) => {
      const rowsForYear = filteredRows.filter(
        (r) => r.year === year && r.finalPrice != null && r.sheetPrice > 0
      );
      const avg =
        rowsForYear.length > 0
          ? rowsForYear.reduce((sum, r) => sum + (r.finalPrice as number) / r.sheetPrice, 0) /
            rowsForYear.length
          : null;
      return { year, avg, count: rowsForYear.length };
    });

  async function loadRows(
    mode: "snapshot" | "reloadPrices" | "reloadOverrides" = "snapshot"
  ) {
    setRunning(true);
    setError(null);
    try {
      const q =
        mode === "reloadPrices"
          ? "?reloadPrices=1"
          : mode === "reloadOverrides"
            ? "?reloadOverrides=1"
            : "";
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

  async function saveOwnershipSnapshot() {
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Enter a username to save ownership snapshot.");
      return;
    }
    setSnapshotBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fire-sale-skins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saveUserSnapshot: true,
          username: trimmed,
          rows,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        username?: string;
        ownedCount?: number;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setSource(
        `ownership_saved:${json.username ?? trimmed}:${json.ownedCount ?? 0}`
      );
      await loadSavedUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function loadOwnershipSnapshot() {
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Enter a username to load ownership snapshot.");
      return;
    }
    setSnapshotBusy(true);
    setError(null);
    try {
      const q = `?loadUserSnapshot=1&username=${encodeURIComponent(trimmed)}`;
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
      setSnapshotBusy(false);
    }
  }

  async function loadSavedUsers() {
    try {
      const res = await fetch("/api/fire-sale-skins?listUserSnapshots=1", {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        usernames?: OwnershipSnapshotUser[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setSavedUsers(json.usernames ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void loadSavedUsers();
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h1 className="text-xl font-semibold tracking-tight">
            Fire Sale skins
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Data loads from your local snapshot file. Use price reload buttons to
            refresh pricing values without rebuilding item rows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
          <button
            type="button"
            onClick={() => void loadRows("snapshot")}
            disabled={running}
            className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Loading…" : "Load local snapshot"}
          </button>
          <button
            type="button"
            onClick={() => void loadRows("reloadPrices")}
            disabled={running}
            className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reload prices
          </button>
          <button
            type="button"
            onClick={() => void loadRows("reloadOverrides")}
            disabled={running}
            className="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reload overrides
          </button>
          {rows.length > 0 ? (
            <span className="text-sm text-zinc-400">
              Showing {filteredRows.length}/{rows.length} rows
            </span>
          ) : null}
          {saving ? <span className="text-xs text-zinc-500">Saving changes…</span> : null}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 sm:flex-row sm:items-center">
          <select
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500 sm:max-w-xs"
          >
            <option value="">Select saved username</option>
            {savedUsers.map((u) => (
              <option key={u.username} value={u.username}>
                {u.username} ({u.ownedCount})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username for ownership snapshot"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-500 sm:max-w-sm"
          />
          <button
            type="button"
            onClick={() => void loadSavedUsers()}
            disabled={snapshotBusy}
            className="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh users
          </button>
          <button
            type="button"
            onClick={() => void saveOwnershipSnapshot()}
            disabled={snapshotBusy || rows.length === 0}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save ownership snapshot
          </button>
          <button
            type="button"
            onClick={() => void loadOwnershipSnapshot()}
            disabled={snapshotBusy}
            className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Load ownership snapshot
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <ToggleSwitch
                checked={showOwned}
                onToggle={() => setShowOwned((v) => !v)}
                label="Show owned"
              />
              Owned
            </label>
            <label className="inline-flex items-center gap-2">
              <ToggleSwitch
                checked={showUnowned}
                onToggle={() => setShowUnowned((v) => !v)}
                label="Show unowned"
              />
              Unowned
            </label>
            <label className="inline-flex items-center gap-2">
              <ToggleSwitch
                checked={advancedMode}
                onToggle={() => setAdvancedMode((v) => !v)}
                label="Advanced mode"
              />
              Advanced mode
            </label>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cosmetic..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-500 sm:max-w-xs"
          />
        </div>

        {advancedMode && availableYears.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-sm">
            <span className="text-zinc-400">Years:</span>
            {availableYears.map((year) => (
              <label key={year} className="inline-flex items-center gap-2">
                <ToggleSwitch
                  checked={selectedYears.includes(year)}
                  onToggle={() => toggleYear(year)}
                  label={`Toggle year ${year}`}
                />
                {year}
              </label>
            ))}
          </div>
        ) : null}
        {advancedMode ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-sm">
            <span className="text-zinc-400">Skin type:</span>
            <label className="inline-flex items-center gap-2">
              <ToggleSwitch
                checked={showPetSkins}
                onToggle={() => setShowPetSkins((v) => !v)}
                label="Show pet skins"
              />
              Pet skins
            </label>
            <label className="inline-flex items-center gap-2">
              <ToggleSwitch
                checked={showArmorSkins}
                onToggle={() => setShowArmorSkins((v) => !v)}
                label="Show armor skins"
              />
              Armor skins
            </label>
            <label className="inline-flex items-center gap-2">
              <ToggleSwitch
                checked={showBackpackSkins}
                onToggle={() => setShowBackpackSkins((v) => !v)}
                label="Show backpack skins"
              />
              Backpack skins
            </label>
          </div>
        ) : null}
        {loaded && generatedAt ? (
          <p className="text-xs text-zinc-500">
            Snapshot: {new Date(generatedAt).toLocaleString()} ({source})
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <p className="text-xs text-zinc-400">Total owned</p>
              <p className="text-lg font-semibold">{ownedRows.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <p className="text-xs text-zinc-400">Total unowned</p>
              <p className="text-lg font-semibold">{unownedRows.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <p className="text-xs text-zinc-400">Owned total value</p>
              <p className="text-lg font-semibold">{formatCoins(ownedTotal)}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <p className="text-xs text-zinc-400">Unowned total value</p>
              <p className="text-lg font-semibold">{formatCoins(unownedTotal)}</p>
            </div>
          </div>
        ) : null}

        {advancedMode ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="mb-2 text-sm font-medium text-zinc-200">Market Cap</p>
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300">
                Total: {formatCoins(totalMarketCap)}
              </span>
            </div>
            <p className="mb-2 text-sm font-medium text-zinc-200">Average Coins/Gem by year</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {averageCoinsPerGemByYear.map((x) => (
                <span
                  key={x.year}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300"
                >
                  {x.year}:{" "}
                  {x.avg != null
                    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(x.avg)
                    : "N/A"}{" "}
                  ({x.count})
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loaded && !error && rows.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
            Loaded 0 rows from local snapshot. Add rows to{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              data/fire-sale-skins-local.json
            </code>{" "}
            and reload.
          </div>
        ) : null}

        {sortedRows.length > 0 ? (
          <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/20">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-900 text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort("owned")}
                      className="inline-flex items-center gap-1 text-left hover:text-zinc-100"
                    >
                      Owned
                      {sortArrowFor("owned")}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort("cosmetic")}
                      className="inline-flex items-center gap-1 text-left hover:text-zinc-100"
                    >
                      Cosmetic
                      {sortArrowFor("cosmetic")}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort("date")}
                      className="inline-flex items-center gap-1 text-left hover:text-zinc-100"
                    >
                      Date
                      {sortArrowFor("date")}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort("stock")}
                      className="inline-flex items-center gap-1 text-left hover:text-zinc-100"
                    >
                      Qty
                      {sortArrowFor("stock")}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("sheetPrice")}
                      className="inline-flex items-center gap-1 hover:text-zinc-100"
                    >
                      Gem cost
                      {sortArrowFor("sheetPrice")}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("finalPrice")}
                      className="inline-flex items-center gap-1 hover:text-zinc-100"
                    >
                      Price
                      {sortArrowFor("finalPrice")}
                    </button>
                  </th>
                  {advancedMode ? (
                    <>
                      <th className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort("marketCap")}
                          className="inline-flex items-center gap-1 hover:text-zinc-100"
                        >
                          Market Cap
                          {sortArrowFor("marketCap")}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort("coinsPerGem")}
                          className="inline-flex items-center gap-1 hover:text-zinc-100"
                        >
                          Coins/Gem
                          {sortArrowFor("coinsPerGem")}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("priceSource")}
                          className="inline-flex items-center gap-1 text-left hover:text-zinc-100"
                        >
                          Source
                          {sortArrowFor("priceSource")}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("skinType")}
                          className="inline-flex items-center gap-1 text-left hover:text-zinc-100"
                        >
                          Type
                          {sortArrowFor("skinType")}
                        </button>
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr
                    key={`${r.cosmetic}:${r.dateAvailable}`}
                    className="border-t border-zinc-800 odd:bg-zinc-900/20"
                  >
                    <td className="px-3 py-2">
                      <ToggleSwitch
                        checked={r.owned}
                        onToggle={() => toggleOwned(r)}
                        label={`Toggle owned for ${r.cosmetic}`}
                      />
                    </td>
                    <td className="px-3 py-2">{r.cosmetic}</td>
                    <td className="px-3 py-2">{r.dateAvailable}</td>
                    <td className="px-3 py-2">{r.stock}</td>
                    <td className="px-3 py-2 text-right">{formatCoins(r.sheetPrice)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.finalPrice != null ? formatCoins(r.finalPrice) : "N/A"}
                    </td>
                    {advancedMode ? (
                      <>
                        <td className="px-3 py-2 text-right">
                          {r.finalPrice != null
                            ? formatCoins(r.finalPrice * Number.parseInt(r.stock, 10))
                            : "N/A"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.finalPrice != null && r.sheetPrice > 0
                            ? new Intl.NumberFormat("en-US", {
                                maximumFractionDigits: 2,
                              }).format(r.finalPrice / r.sheetPrice)
                            : "N/A"}
                        </td>
                        <td className="px-3 py-2">
                          {r.priceSource === "manual_override"
                            ? "Manual override"
                            : r.priceSource === "cofl_monthly_median"
                              ? "COFL median"
                              : "Missing"}
                        </td>
                        <td className="px-3 py-2 capitalize">{getSkinType(r.cosmetic)}</td>
                      </>
                    ) : null}
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

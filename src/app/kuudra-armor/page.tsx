"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { formatCoins } from "@/lib/format";
import {
  KUUDRA_ARMOR_FAMILIES,
  KUUDRA_ARMOR_WIKI_CRIMSON,
  KUUDRA_INFERNAL_STAR_COUNT,
  type KuudraCraftStep,
  type KuudraEndTier,
} from "@/lib/kuudra-armor-crafting";

const END_TIERS: { value: KuudraEndTier; label: string }[] = [
  { value: "hot", label: "Hot (Basic 10★ + prestige)" },
  { value: "burning", label: "Burning (+ Hot path)" },
  { value: "fiery", label: "Fiery (+ Burning path)" },
  {
    value: "infernal",
    label: `Infernal (+ Fiery path; use slider for Infernal ★1–${KUUDRA_INFERNAL_STAR_COUNT})`,
  },
];

type ApiOk = {
  steps: KuudraCraftStep[];
  materials: {
    essence: number;
    heavyPearls: number;
    kuudraTeeth: number;
    blacksmithCoins: number;
  };
  bazaar: {
    essencePerUnit: number;
    heavyPearlPerUnit: number;
    kuudraTeethPerUnit: number;
    subtotal: number;
  };
  blacksmithCoins: number;
  totalCraftCoins: number;
  infernalStars: number;
};

const selectClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500";

export default function KuudraArmorPage() {
  const [familyId, setFamilyId] = useState(KUUDRA_ARMOR_FAMILIES[0].id);
  const [endTier, setEndTier] = useState<KuudraEndTier>("infernal");
  const [infernalStars, setInfernalStars] = useState(0);
  const [data, setData] = useState<ApiOk | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ endTier });
      if (endTier === "infernal") {
        q.set("infernalStars", String(infernalStars));
      }
      const res = await fetch(`/api/kuudra-armor?${q.toString()}`);
      const j = (await res.json()) as ApiOk & { error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [endTier, infernalStars]);

  useEffect(() => {
    void load();
  }, [load]);

  const family = KUUDRA_ARMOR_FAMILIES.find((f) => f.id === familyId);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Kuudra armor — Essence craft
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Costs follow the{" "}
            <a
              href={KUUDRA_ARMOR_WIKI_CRIMSON}
              className="text-sky-400 underline"
              target="_blank"
              rel="noreferrer"
            >
              Crimson Armor Essence Crafting
            </a>{" "}
            table: start from a <strong className="text-zinc-300">Basic</strong>{" "}
            drop piece, apply 10★ and prestige through each tier up to your
            target. Crimson, Aurora, Fervor, Terror, and Hollow use the same
            numbers; only the base piece differs.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-300">Set</label>
            <select
              className={selectClass}
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value as typeof familyId)}
            >
              {KUUDRA_ARMOR_FAMILIES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              {family?.wikiNote}. Base piece BIN is not included — only
              blacksmith Essence costs.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300">
              Target tier (from Basic)
            </label>
            <select
              className={selectClass}
              value={endTier}
              onChange={(e) => setEndTier(e.target.value as KuudraEndTier)}
            >
              {END_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {endTier === "infernal" && (
          <div>
            <label className="text-sm font-medium text-zinc-300">
              Infernal stars (0–{KUUDRA_INFERNAL_STAR_COUNT})
            </label>
            <input
              type="range"
              min={0}
              max={KUUDRA_INFERNAL_STAR_COUNT}
              value={infernalStars}
              onChange={(e) => setInfernalStars(Number(e.target.value))}
              className="mt-2 w-full accent-sky-500"
            />
            <p className="mt-1 text-sm text-zinc-400">
              Infernal ★{infernalStars} — ★0 is the wiki cumulative to unlock
              Infernal (Fiery→Infernal prestige only); raise the slider for ★1–
              {KUUDRA_INFERNAL_STAR_COUNT}.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="w-fit rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh prices"}
        </button>

        {err && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    One piece — Bazaar + blacksmith
                  </span>
                  <p className="font-mono text-lg font-semibold text-sky-300">
                    {formatCoins(data.totalCraftCoins)}
                  </p>
                </div>
                <div className="text-xs text-zinc-500">
                  Bazaar mats: {formatCoins(data.bazaar.subtotal)} · Blacksmith:{" "}
                  {formatCoins(data.blacksmithCoins)}
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Essence {data.materials.essence.toLocaleString()} · Heavy Pearl ×
                {data.materials.heavyPearls} · Kuudra Teeth ×
                {data.materials.kuudraTeeth}
                {data.infernalStars > 0 &&
                  ` · Infernal ★${data.infernalStars} included`}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-sm font-semibold text-zinc-200">
                Steps ({data.steps.length})
              </h2>
              <ul className="mt-3 max-h-[420px] space-y-1 overflow-y-auto text-sm">
                {data.steps.map((s) => (
                  <li
                    key={s.label}
                    className="flex justify-between gap-2 border-b border-zinc-800/50 py-1.5 font-mono text-xs text-zinc-300 last:border-0"
                  >
                    <span className="text-zinc-500">{s.label}</span>
                    <span className="shrink-0 text-right text-zinc-400">
                      E{s.essence.toLocaleString()}
                      {s.heavyPearls > 0 && ` · HP×${s.heavyPearls}`}
                      {s.kuudraTeeth > 0 && ` · KT×${s.kuudraTeeth}`}
                      {s.blacksmithCoins > 0 &&
                        ` · ${formatCoins(s.blacksmithCoins)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

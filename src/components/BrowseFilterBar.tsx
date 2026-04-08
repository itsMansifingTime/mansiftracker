"use client";

import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BROWSE_FILTER_OPTIONS,
  type ActiveBrowseFilter,
  defaultNewFilter,
  RARITY_OPTIONS,
} from "@/lib/browse-filters";
import type { BrowseFilterHints } from "@/lib/browse-hints";
import {
  SKYBLOCK_DYE_IDS,
  SKYBLOCK_RUNE_IDS,
  SKYBLOCK_SKIN_IDS,
} from "@/lib/skyblock-cosmetic-ids";
import { SKYBLOCK_ENCHANT_IDS } from "@/lib/skyblock-enchant-ids";

/** Common top-level `extra_attributes` keys (Hypixel NBT slice) for NBT field autocomplete. */
const COMMON_EXTRA_ATTR_KEYS: readonly string[] = [
  "ability",
  "ability_scroll",
  "anvil_uses",
  "donated_museum",
  "dungeon_item_level",
  "enchantments",
  "fuming_potato_count",
  "gems",
  "gemstones",
  "hpc",
  "hot_potato_count",
  "id",
  "dye_item",
  "modifier",
  "originTag",
  "rarity_upgrades",
  "soulbound",
  "timestamp",
  "upgrade_level",
  "uuid",
];

type Props = {
  filters: ActiveBrowseFilter[];
  onFiltersChange: (next: ActiveBrowseFilter[]) => void;
};

type FilterUiContext = {
  mergedEnchantKeys: string[];
  mergedNbtKeys: string[];
  mergedDyeKeys: string[];
  mergedRuneKeys: string[];
  mergedSkinKeys: string[];
  rarityOptions: string[];
  reforgeModifiers: string[];
};

function filterLabel(f: ActiveBrowseFilter): string {
  if (f.id === "enchant") return f.key ? `Enchant · ${f.key}` : "Enchant";
  if (f.id === "dye") return f.key ? `Dye · ${f.key}` : "Dye";
  if (f.id === "rune") return f.key ? `Rune · ${f.key}` : "Rune";
  if (f.id === "skin") return f.key ? `Skin · ${f.key}` : "Skin";
  if (f.id === "nbt_field") return f.key ? `NBT · ${f.key}` : "NBT field";
  return (
    BROWSE_FILTER_OPTIONS.find((o) => o.id === f.id)?.label ?? f.id
  );
}

/**
 * Match user input to snake_case ids: spaces and underscores are ignored so
 * e.g. "chaos terror" matches CHAOS_TERROR_HELMET.
 */
function keySuggestMatches(id: string, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;
  const h = id.toLowerCase();
  if (h.includes(q)) return true;
  const qAlnum = q.replace(/[^a-z0-9]+/g, "");
  const hAlnum = h.replace(/[^a-z0-9]+/g, "");
  return qAlnum.length >= 1 && hAlnum.includes(qAlnum);
}

const KEY_SUGGEST_MAX = 30;

/** Type-ahead + autofill: first rows on empty focus; filter when typing; ↑↓ Enter. */
function KeySuggestFilterRow({
  label,
  placeholder,
  footer,
  keyValue,
  onChange,
  remove,
  allKeys,
  lowercaseInput,
}: {
  label: string;
  placeholder: string;
  footer: ReactNode;
  keyValue: string;
  onChange: (v: string) => void;
  remove: ReactNode;
  allKeys: string[];
  /** Enchant / NBT field keys are normalized to lowercase. */
  lowercaseInput: boolean;
}) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const suggestions = useMemo(() => {
    const q = keyValue.trim();
    if (q.length < 1) return allKeys.slice(0, KEY_SUGGEST_MAX);
    return allKeys.filter((k) => keySuggestMatches(k, q)).slice(0, KEY_SUGGEST_MAX);
  }, [keyValue, allKeys]);

  useEffect(() => {
    setHighlight(0);
  }, [keyValue]);

  const applySuggestion = useCallback(
    (s: string) => {
      onChange(lowercaseInput ? s.toLowerCase() : s);
      setSuggestOpen(false);
    },
    [onChange, lowercaseInput]
  );

  return (
    <div className="relative flex min-w-[280px] max-w-md flex-1 flex-col gap-1 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-zinc-400">{label}</span>
        <input
          type="text"
          spellCheck={false}
          autoComplete="off"
          placeholder={placeholder}
          role="combobox"
          aria-expanded={suggestOpen && suggestions.length > 0}
          aria-autocomplete="list"
          className="min-w-[160px] flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500"
          value={keyValue}
          onChange={(e) => {
            setSuggestOpen(true);
            onChange(
              lowercaseInput ? e.target.value.toLowerCase() : e.target.value
            );
          }}
          onFocus={() => setSuggestOpen(true)}
          onBlur={() => {
            setTimeout(() => setSuggestOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSuggestOpen(false);
              return;
            }
            if (!suggestions.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSuggestOpen(true);
              setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSuggestOpen(true);
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter" && suggestOpen) {
              e.preventDefault();
              const s = suggestions[highlight];
              if (s) applySuggestion(s);
            }
          }}
        />
        {remove}
      </div>
      {suggestOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-0 max-h-40 overflow-y-auto rounded border border-zinc-700 bg-zinc-950 py-1 shadow-lg"
        >
          {suggestions.map((s, idx) => (
            <li key={s} role="option" aria-selected={idx === highlight}>
              <button
                type="button"
                className={`w-full px-2 py-1 text-left font-mono text-xs ${
                  idx === highlight
                    ? "bg-zinc-700 text-zinc-50"
                    : "text-zinc-200 hover:bg-zinc-800"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => applySuggestion(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-zinc-600">{footer}</p>
    </div>
  );
}

const REFORGE_SUGGEST_MAX = 25;

function ReforgeFilterRow({
  value,
  onChange,
  remove,
  modifiersFromDb,
}: {
  value: string;
  onChange: (v: string) => void;
  remove: ReactNode;
  modifiersFromDb: string[];
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 1) return modifiersFromDb.slice(0, REFORGE_SUGGEST_MAX);
    return modifiersFromDb
      .filter((m) => m.toLowerCase().includes(q))
      .slice(0, REFORGE_SUGGEST_MAX);
  }, [value, modifiersFromDb]);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  return (
    <div className="relative flex min-w-[220px] max-w-md flex-1 flex-col gap-1 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-zinc-400">Reforge</span>
        <input
          type="text"
          spellCheck={false}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-autocomplete="list"
          placeholder="modifier (e.g. withered) — DB hints below"
          className="min-w-[120px] flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500"
          value={value}
          onChange={(e) => {
            setOpen(true);
            onChange(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!suggestions.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              const s = suggestions[highlight];
              if (s) {
                onChange(s);
                setOpen(false);
              }
            }
          }}
        />
        {remove}
      </div>
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-0 max-h-36 overflow-y-auto rounded border border-zinc-700 bg-zinc-950 py-1 shadow-lg"
        >
          {suggestions.map((s, idx) => (
            <li key={s} role="option" aria-selected={idx === highlight}>
              <button
                type="button"
                className={`w-full px-2 py-1 text-left text-xs ${
                  idx === highlight
                    ? "bg-zinc-700 text-zinc-50"
                    : "text-zinc-200 hover:bg-zinc-800"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderFilterEditor(
  f: ActiveBrowseFilter,
  i: number,
  onPatch: (index: number, next: ActiveBrowseFilter) => void,
  onRemove: (index: number) => void,
  ctx: FilterUiContext
) {
  const remove = (
    <button
      type="button"
      onClick={() => onRemove(i)}
      className="shrink-0 rounded px-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
      aria-label={`Remove ${filterLabel(f)}`}
    >
      ×
    </button>
  );

  switch (f.id) {
    case "rarity":
      return (
        <div
          key={`rarity-${i}`}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm"
        >
          <span className="text-zinc-400">{filterLabel(f)}</span>
          <select
            className="rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-200 outline-none focus:border-sky-500"
            value={f.value}
            onChange={(e) =>
              onPatch(i, { id: "rarity", value: e.target.value })
            }
          >
            {ctx.rarityOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {remove}
        </div>
      );
    case "reforge":
      return (
        <ReforgeFilterRow
          key={`reforge-${i}`}
          value={f.value}
          onChange={(v) => onPatch(i, { id: "reforge", value: v })}
          remove={remove}
          modifiersFromDb={ctx.reforgeModifiers}
        />
      );
    case "stars":
      return (
        <div
          key={`stars-${i}`}
          className="flex max-w-xl flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm sm:flex-row sm:flex-wrap sm:items-center"
        >
          <span className="text-zinc-400">{filterLabel(f)}</span>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">
              Quick
            </span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                title={`Exactly ${n} star(s) (upgrade_level)`}
                className={`rounded px-2 py-0.5 font-mono text-xs tabular-nums transition ${
                  f.value === n
                    ? "bg-sky-800 text-sky-100 ring-1 ring-sky-500"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                onClick={() => onPatch(i, { id: "stars", value: n })}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-zinc-500">0–15</span>
            <input
              type="number"
              min={0}
              max={15}
              title="Total upgrade stars (includes master stars on weapons)"
              className="w-16 rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-200 outline-none focus:border-sky-500"
              value={f.value}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(n)) return;
                onPatch(i, {
                  id: "stars",
                  value: Math.min(15, Math.max(0, n)),
                });
              }}
            />
          </div>
          {remove}
        </div>
      );
    case "bin":
    case "sold":
    case "recombobulated":
    case "soulbound":
    case "has_dye":
    case "has_rune":
    case "has_skin":
      return (
        <div
          key={`${f.id}-${i}`}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm"
        >
          <span className="text-zinc-400">{filterLabel(f)}</span>
          <select
            className="rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-200 outline-none focus:border-sky-500"
            value={f.value ? "yes" : "no"}
            onChange={(e) => {
              const v = e.target.value === "yes";
              switch (f.id) {
                case "bin":
                  onPatch(i, { id: "bin", value: v });
                  break;
                case "sold":
                  onPatch(i, { id: "sold", value: v });
                  break;
                case "recombobulated":
                  onPatch(i, { id: "recombobulated", value: v });
                  break;
                case "soulbound":
                  onPatch(i, { id: "soulbound", value: v });
                  break;
                case "has_dye":
                  onPatch(i, { id: "has_dye", value: v });
                  break;
                case "has_rune":
                  onPatch(i, { id: "has_rune", value: v });
                  break;
                case "has_skin":
                  onPatch(i, { id: "has_skin", value: v });
                  break;
              }
            }}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          {remove}
        </div>
      );
    case "highest_bid":
      return (
        <div
          key={`hb-${i}`}
          className="flex min-w-[220px] flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm"
        >
          <span className="text-zinc-400" title="Minimum price (coins)">
            {filterLabel(f)}
          </span>
          <input
            type="number"
            min={1}
            className="min-w-[100px] flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-200 outline-none focus:border-sky-500"
            value={f.value}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isFinite(n) || n < 1) return;
              onPatch(i, { id: "highest_bid", value: n });
            }}
          />
          {remove}
        </div>
      );
    case "min_hpc":
    case "min_fuming":
      return (
        <div
          key={`${f.id}-${i}`}
          className="flex min-w-[220px] flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-sm"
        >
          <span className="text-zinc-400" title="Minimum count (0–64)">
            {filterLabel(f)}
          </span>
          <input
            type="number"
            min={0}
            max={64}
            className="min-w-[80px] flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-200 outline-none focus:border-sky-500"
            value={f.value}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isFinite(n)) return;
              const clamped = Math.min(64, Math.max(0, n));
              if (f.id === "min_hpc")
                onPatch(i, { id: "min_hpc", value: clamped });
              else onPatch(i, { id: "min_fuming", value: clamped });
            }}
          />
          {remove}
        </div>
      );
    case "enchant":
      return (
        <KeySuggestFilterRow
          key={`enchant-row-${i}`}
          label="Enchant"
          placeholder="NBT key (snake_case) — any Hypixel id"
          footer={
            <>
              Suggestions merge built-in ids with{" "}
              <span className="text-zinc-500">distinct keys from your DB</span>.
              Add multiple Enchant filters for AND.
            </>
          }
          keyValue={f.key}
          onChange={(v) => onPatch(i, { id: "enchant", key: v })}
          remove={remove}
          allKeys={ctx.mergedEnchantKeys}
          lowercaseInput
        />
      );
    case "dye":
      return (
        <KeySuggestFilterRow
          key={`dye-row-${i}`}
          label="Dye"
          placeholder="dye_item / dye id (e.g. DYE_AQUAMARINE)"
          footer={
            <>
              Matches <span className="text-zinc-500">dye_item</span> /{" "}
              <span className="text-zinc-500">dye</span> /{" "}
              <span className="text-zinc-500">Dye</span>. Suggestions merge built-in
              ids with <span className="text-zinc-500">distinct values from your DB</span>.
            </>
          }
          keyValue={f.key}
          onChange={(v) => onPatch(i, { id: "dye", key: v })}
          remove={remove}
          allKeys={ctx.mergedDyeKeys}
          lowercaseInput={false}
        />
      );
    case "rune":
      return (
        <KeySuggestFilterRow
          key={`rune-row-${i}`}
          label="Rune"
          placeholder="Rune key under runes {} (e.g. GOLDEN_CARPET)"
          footer={
            <>
              Matches <span className="text-zinc-500">extra_attributes→runes→key</span>
              . Same idea as Enchant but under runes.
            </>
          }
          keyValue={f.key}
          onChange={(v) => onPatch(i, { id: "rune", key: v })}
          remove={remove}
          allKeys={ctx.mergedRuneKeys}
          lowercaseInput={false}
        />
      );
    case "skin":
      return (
        <KeySuggestFilterRow
          key={`skin-row-${i}`}
          label="Skin"
          placeholder="ExtraAttributes skin id (e.g. GLACIAL_HEDGEHOG)"
          footer={
            <>
              Matches <span className="text-zinc-500">extra_attributes→skin</span>{" "}
              string. Add multiple for AND.
            </>
          }
          keyValue={f.key}
          onChange={(v) => onPatch(i, { id: "skin", key: v })}
          remove={remove}
          allKeys={ctx.mergedSkinKeys}
          lowercaseInput={false}
        />
      );
    case "nbt_field":
      return (
        <KeySuggestFilterRow
          key={`nbt-row-${i}`}
          label="NBT field"
          placeholder="Top-level extra_attributes key (snake_case)"
          footer={
            <>
              Matches rows where that key is present on{" "}
              <span className="text-zinc-500">extra_attributes</span>. Add
              multiple for AND.
            </>
          }
          keyValue={f.key}
          onChange={(v) => onPatch(i, { id: "nbt_field", key: v })}
          remove={remove}
          allKeys={ctx.mergedNbtKeys}
          lowercaseInput
        />
      );
    default:
      return null;
  }
}

export function BrowseFilterBar({ filters, onFiltersChange }: Props) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [hints, setHints] = useState<BrowseFilterHints | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/browse/hints");
        const j = (await res.json()) as unknown;
        if (!res.ok || cancelled) return;
        if (j && typeof j === "object") {
          const h = j as Partial<BrowseFilterHints>;
          if (
            Array.isArray(h.enchant_keys) ||
            Array.isArray(h.extra_attribute_keys) ||
            Array.isArray(h.dye_ids)
          ) {
            setHints({
              enchant_keys: Array.isArray(h.enchant_keys)
                ? h.enchant_keys
                : [],
              dye_ids: Array.isArray(h.dye_ids) ? h.dye_ids : [],
              extra_attribute_keys: Array.isArray(h.extra_attribute_keys)
                ? h.extra_attribute_keys
                : [],
              modifiers: Array.isArray(h.modifiers) ? h.modifiers : [],
              item_rarities: Array.isArray(h.item_rarities)
                ? h.item_rarities
                : [],
              item_ids: Array.isArray(h.item_ids) ? h.item_ids : [],
            });
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedEnchantKeys = useMemo(() => {
    const s = new Set<string>(SKYBLOCK_ENCHANT_IDS);
    for (const k of hints?.enchant_keys ?? []) s.add(k);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [hints]);

  const mergedNbtKeys = useMemo(() => {
    const s = new Set<string>(COMMON_EXTRA_ATTR_KEYS);
    for (const k of hints?.extra_attribute_keys ?? []) s.add(k);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [hints]);

  const mergedDyeKeys = useMemo(() => {
    const s = new Set<string>(SKYBLOCK_DYE_IDS);
    for (const k of hints?.dye_ids ?? []) s.add(k);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [hints]);
  const mergedRuneKeys = useMemo(() => [...SKYBLOCK_RUNE_IDS], []);
  const mergedSkinKeys = useMemo(() => [...SKYBLOCK_SKIN_IDS], []);

  const rarityOptions = useMemo(() => {
    const s = new Set<string>(RARITY_OPTIONS);
    for (const r of hints?.item_rarities ?? []) s.add(r);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [hints]);

  const reforgeModifiers = useMemo(
    () =>
      [...(hints?.modifiers ?? [])].sort((a, b) => a.localeCompare(b)),
    [hints]
  );

  const filterCtx = useMemo<FilterUiContext>(
    () => ({
      mergedEnchantKeys,
      mergedNbtKeys,
      mergedDyeKeys,
      mergedRuneKeys,
      mergedSkinKeys,
      rarityOptions,
      reforgeModifiers,
    }),
    [
      mergedEnchantKeys,
      mergedNbtKeys,
      mergedDyeKeys,
      mergedRuneKeys,
      mergedSkinKeys,
      rarityOptions,
      reforgeModifiers,
    ]
  );

  /** One row per core filter; multiple key-based rows allowed. */
  const taken = useMemo(() => {
    const s = new Set<string>();
    for (const f of filters) {
      if (
        f.id === "enchant" ||
        f.id === "nbt_field" ||
        f.id === "dye" ||
        f.id === "rune" ||
        f.id === "skin"
      )
        continue;
      s.add(f.id);
    }
    return s;
  }, [filters]);

  const availableToAdd = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    return BROWSE_FILTER_OPTIONS.filter((o) => {
      if (
        o.id === "enchant" ||
        o.id === "nbt_field" ||
        o.id === "dye" ||
        o.id === "rune" ||
        o.id === "skin"
      ) {
        if (!q) return true;
        return (
          o.label.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
        );
      }
      if (taken.has(o.id)) return false;
      if (!q) return true;
      return (
        o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
      );
    });
  }, [taken, addSearch]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const addFilter = useCallback(
    (id: string) => {
      const next = defaultNewFilter(id);
      if (!next) return;
      onFiltersChange([...filters, next]);
      setAddSearch("");
      setMenuOpen(false);
    },
    [filters, onFiltersChange]
  );

  const onPatch = useCallback(
    (index: number, next: ActiveBrowseFilter) => {
      onFiltersChange(filters.map((x, j) => (j === index ? next : x)));
    },
    [filters, onFiltersChange]
  );

  const onRemove = useCallback(
    (index: number) => {
      onFiltersChange(filters.filter((_, j) => j !== index));
    },
    [filters, onFiltersChange]
  );

  return (
    <div className="flex flex-col gap-3">
      <div ref={rootRef} className="relative max-w-md">
        <input
          type="text"
          role="combobox"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-autocomplete="list"
          placeholder="Add filter"
          className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          value={addSearch}
          onChange={(e) => {
            setAddSearch(e.target.value);
            setMenuOpen(true);
          }}
          onFocus={() => setMenuOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenuOpen(false);
            if (e.key === "Enter" && availableToAdd.length === 1) {
              e.preventDefault();
              addFilter(availableToAdd[0].id);
            }
          }}
        />
        {menuOpen && (
          <ul
            id={menuId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-black py-1 shadow-xl"
          >
            {availableToAdd.length === 0 ? (
              <li className="px-3 py-2 text-xs text-zinc-500">
                No matching filters
              </li>
            ) : (
              availableToAdd.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-900"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addFilter(o.id)}
                  >
                    {o.label}
                    {o.id === "enchant" ||
                    o.id === "nbt_field" ||
                    o.id === "dye" ||
                    o.id === "rune" ||
                    o.id === "skin" ? (
                      <span className="ml-2 text-xs text-zinc-500">
                        {o.id === "enchant"
                          ? "(type any id)"
                          : o.id === "nbt_field"
                            ? "(top-level key)"
                            : "(cosmetic id)"}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((f, i) =>
            renderFilterEditor(f, i, onPatch, onRemove, filterCtx)
          )}
        </div>
      )}
    </div>
  );
}

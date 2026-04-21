import type { BazaarProduct } from "./bazaar";
import { getProduct } from "./bazaar";
import { fetchLowestBinByTag } from "./coflnet";
import {
  getGemSlotUnlockRecipesForExtraAndTag,
  hyperionSlotUnlockCost,
} from "./gemstone-slots";
import { resolveReforgeStoneProduct } from "./reforge-stone-by-modifier";

export type ModifierCostLine = { label: string; cost: number };

/**
 * Walk simplified item NBT from `decodeSkyblockItemBytes().fullNbt` to ExtraAttributes.
 */
export function getExtraAttributesFromFullNbt(
  fullNbt: Record<string, unknown> | unknown[] | null | undefined
): Record<string, unknown> | null {
  if (!fullNbt || typeof fullNbt !== "object") return null;
  if (Array.isArray(fullNbt)) return null;
  const root = fullNbt as Record<string, unknown>;

  const tryTag = (tag: unknown): Record<string, unknown> | null => {
    if (!tag || typeof tag !== "object") return null;
    const ea = (tag as Record<string, unknown>).ExtraAttributes;
    if (ea && typeof ea === "object") return ea as Record<string, unknown>;
    return null;
  };

  if (Array.isArray(root.i) && root.i.length > 0 && typeof root.i[0] === "object") {
    const t = tryTag((root.i[0] as Record<string, unknown>).tag);
    if (t) return t;
  }
  const fromRoot = tryTag(root.tag);
  if (fromRoot) return fromRoot;

  return null;
}

/**
 * Merge Cofl flat NBT + optional nested `nbtData.data` + decoded item bytes ExtraAttributes.
 * Later sources override earlier keys.
 */
export function mergeItemExtraAttributes(
  flatNbt: Record<string, unknown> | undefined,
  nbtDataData: Record<string, unknown> | undefined,
  fromItemBytes: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(flatNbt ?? {}) };
  if (nbtDataData) {
    for (const [k, v] of Object.entries(nbtDataData)) {
      if (v !== undefined && v !== null) out[k] = v;
    }
  }
  if (fromItemBytes) {
    for (const [k, v] of Object.entries(fromItemBytes)) {
      if (v !== undefined && v !== null) out[k] = v;
    }
  }
  return out;
}

const GEM_QUALITIES = new Set([
  "ROUGH",
  "FLAWED",
  "FINE",
  "FLAWLESS",
  "PERFECT",
]);

/** Slot key prefix (before `_0`) — not always the gem type (e.g. COMBAT = combat line, stores sapphire on blades). */
const DIRECT_GEM_PREFIXES = new Set([
  "SAPPHIRE",
  "RUBY",
  "AMETHYST",
  "JADE",
  "JASPER",
  "OPAL",
  "TOPAZ",
  "AMBER",
  "ONYX",
  "CITRINE",
  "AQUAMARINE",
  "PERIDOT",
]);

/**
 * Map Hypixel slot family → bazaar `*_GEM` middle segment.
 * `COMBAT_*` / `SAPPHIRE_*` quality strings align with Hyperion breakdown (COMBAT_0 === "PERFECT" → sapphire).
 */
function gemTypeFromSlotPrefix(slotPrefix: string): string | null {
  const p = slotPrefix.toUpperCase();
  /** Combat / offensive lines store quality-only; blades use sapphire (matches Hyperion `COMBAT_0 === "PERFECT"`). */
  if (p === "COMBAT" || p === "OFFENSIVE") return "SAPPHIRE";
  if (p === "DEFENSIVE") return "RUBY";
  if (p === "UNIVERSAL") return null;
  if (DIRECT_GEM_PREFIXES.has(p)) return p;
  return null;
}

/** Parse `gem_type` / free text for a known gem name substring. */
function gemTypeFromExplicitField(raw: string): string | null {
  const u = raw.toUpperCase();
  for (const g of DIRECT_GEM_PREFIXES) {
    if (u.includes(g)) return g;
  }
  return null;
}

function parseGemstoneSlot(
  key: string,
  val: unknown
): { productId: string; label: string } | null {
  const typeMatch = key.match(/^([A-Z]+)_\d+$/i);
  if (!typeMatch) return null;
  const slotPrefix = typeMatch[1].toUpperCase();

  let quality: string | null = null;
  let explicitGemType: string | null = null;

  if (typeof val === "string") {
    quality = val.trim().toUpperCase();
  } else if (val && typeof val === "object") {
    const o = val as Record<string, unknown>;
    const q = o.quality ?? o.tier;
    if (typeof q === "string") quality = q.trim().toUpperCase();
    const rawG = o.gem_type ?? o.gemType ?? o.gem;
    if (typeof rawG === "string") {
      explicitGemType = gemTypeFromExplicitField(rawG);
    }
  }

  if (!quality || !GEM_QUALITIES.has(quality)) return null;

  const gemType =
    explicitGemType ?? gemTypeFromSlotPrefix(slotPrefix);
  if (!gemType) return null;

  const productId = `${quality}_${gemType}_GEM`;
  return { productId, label: `${productId} (${key})` };
}

function tryParseGemstonesContainer(
  raw: unknown
): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/**
 * Cofl often exposes gems as flat keys (`COMBAT_0`), not only under `gemstones`.
 * Use the same discovery for unlock rows as for applied-gem pricing.
 */
function collectGemSlotEntries(
  extra: Record<string, unknown>
): [string, unknown][] {
  const out: [string, unknown][] = [];
  const seen = new Set<string>();

  const nested = tryParseGemstonesContainer(
    extra.gemstones ?? extra.Gems ?? extra.gems
  );
  if (nested) {
    for (const [k, v] of Object.entries(nested)) {
      if (!parseGemstoneSlot(k, v)) continue;
      seen.add(k);
      out.push([k, v]);
    }
  }

  for (const [k, v] of Object.entries(extra)) {
    if (seen.has(k)) continue;
    if (!parseGemstoneSlot(k, v)) continue;
    out.push([k, v]);
  }

  return out;
}

function hasGemSlotsOrUnlocked(extra: Record<string, unknown>): boolean {
  if (String(extra.unlocked_slots ?? "").length > 0) return true;
  return collectGemSlotEntries(extra).length > 0;
}

function appendGemSlotUnlockLines(
  lines: ModifierCostLine[],
  extra: Record<string, unknown>,
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number,
  itemTag?: string,
  itemName?: string
): void {
  if (!hasGemSlotsOrUnlocked(extra)) return;
  const recipes = getGemSlotUnlockRecipesForExtraAndTag(
    extra,
    itemTag,
    itemName
  );
  if (!recipes) return;

  for (const recipe of recipes) {
    lines.push({
      label: recipe.label,
      cost: Math.round(hyperionSlotUnlockCost(recipe, products, instantSell)),
    });
  }
}

function collectGemstoneLines(
  extra: Record<string, unknown>,
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number
): ModifierCostLine[] {
  const lines: ModifierCostLine[] = [];
  for (const [key, val] of collectGemSlotEntries(extra)) {
    const parsed = parseGemstoneSlot(key, val);
    if (!parsed) continue;
    const u = instantSell(getProduct(products, parsed.productId));
    lines.push({ label: parsed.label, cost: Math.round(u) });
  }
  return lines;
}

export type BuildModifierCostOptions = {
  /** Cofl auction tag when `extra.id` is missing or wrong for gem unlocks. */
  itemTag?: string;
  /** Cofl `itemName` — fallback to detect Necron’s Blade when id/tag disagree. */
  itemName?: string;
};

const MASTER_STAR_IDS = [
  "FIRST_MASTER_STAR",
  "SECOND_MASTER_STAR",
  "THIRD_MASTER_STAR",
  "FOURTH_MASTER_STAR",
  "FIFTH_MASTER_STAR",
] as const;

function clampInt(raw: unknown, min: number, max: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

/**
 * Dungeon stars from ExtraAttributes:
 * - `upgrade_level` = regular stars (0..5)
 * - `dungeon_item_level` = master stars (0..5)
 * - legacy fallback: if `upgrade_level` is 6..10 and master field is missing, treat overflow as master.
 */
export function resolveDungeonStarLevels(extra: Record<string, unknown>): {
  regular: number;
  master: number;
  total: number;
} {
  const regularRaw = clampInt(extra.upgrade_level ?? extra.upgradeLevel, 0, 10);
  let regular = Math.min(5, regularRaw);
  let master = clampInt(
    extra.dungeon_item_level ?? extra.dungeonItemLevel,
    0,
    5
  );

  if (master === 0 && regularRaw > 5) {
    master = Math.min(5, regularRaw - 5);
    regular = 5;
  }

  return { regular, master, total: Math.min(10, regular + master) };
}

export function masterStarCostFromExtra(
  extra: Record<string, unknown>,
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number
): ModifierCostLine | null {
  const { master } = resolveDungeonStarLevels(extra);
  if (master <= 0) return null;
  let cost = 0;
  for (let i = 0; i < master; i++) {
    cost += instantSell(getProduct(products, MASTER_STAR_IDS[i]));
  }
  return {
    label: master === 1 ? "Master Star (×1)" : `Master Stars (×${master})`,
    cost: Math.round(cost),
  };
}

export function buildGemCostLines(
  extra: Record<string, unknown>,
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number,
  opts?: BuildModifierCostOptions
): ModifierCostLine[] {
  const lines: ModifierCostLine[] = [];
  appendGemSlotUnlockLines(
    lines,
    extra,
    products,
    instantSell,
    opts?.itemTag,
    opts?.itemName
  );
  lines.push(...collectGemstoneLines(extra, products, instantSell));
  return lines;
}

/**
 * Hot Potato Book count from ExtraAttributes.
 * Combined `hpc` (or `hot_potato_count`): **1–10** = that many HPBs; **11–15** still counts as **10** hot
 * for this layer — the overflow is fuming, see {@link resolveFumingPotatoCount}.
 */
export function resolveHotPotatoBookCount(
  extra: Record<string, unknown>
): number {
  const raw = Math.floor(Number(extra.hpc ?? extra.hot_potato_count ?? 0));
  if (!Number.isFinite(raw)) return 0;
  return Math.min(10, Math.max(0, raw));
}

/**
 * Fuming Potato Book count (max 5). Prefer explicit `fuming_potato_count`; else infer from combined
 * `hpc` / `hot_potato_count` when **> 10** (11–15 ⇒ 1–5 fuming; hot layer is still capped at 10).
 */
export function resolveFumingPotatoCount(
  extra: Record<string, unknown>
): number {
  const explicit = Math.floor(Number(extra.fuming_potato_count ?? 0));
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.min(5, Math.max(0, explicit));
  }
  const hpcTotal = Math.floor(
    Number(extra.hpc ?? extra.hot_potato_count ?? 0)
  );
  if (!Number.isFinite(hpcTotal) || hpcTotal <= 10) return 0;
  return Math.min(5, hpcTotal - 10);
}

/** Wet Book on fishing rods: `wet_book_count` (max 5). */
export function resolveWetBookCount(extra: Record<string, unknown>): number {
  const raw = Number(extra.wet_book_count ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(5, Math.max(0, Math.floor(raw)));
}

/**
 * Bazaar-priced modifiers from ExtraAttributes: recomb, potato books, wood singularity,
 * reforge stone (when `modifier` maps to a bazaar Reforge Stone),
 * Geo gem slot unlocks when `gemstone-slots` has recipes for this item id, applied gems,
 * Rod line / hook / sinker are returned separately for their own breakdown section (**lowest
 * active BIN** via Cofl when available, else bazaar instant buy).
 */
export async function buildModifierCostLines(
  extra: Record<string, unknown>,
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number,
  opts?: BuildModifierCostOptions
): Promise<{
  lines: ModifierCostLine[];
  rodLines: ModifierCostLine[];
}> {
  const lines: ModifierCostLine[] = [];

  if (Number(extra.rarity_upgrades) >= 1) {
    const u = instantSell(getProduct(products, "RECOMBOBULATOR_3000"));
    lines.push({ label: "Recombobulator 3000", cost: Math.round(u) });
  }

  const hpb = resolveHotPotatoBookCount(extra);
  if (hpb > 0) {
    const u = instantSell(getProduct(products, "HOT_POTATO_BOOK"));
    lines.push({
      label: `Hot Potato Book (×${hpb})`,
      cost: Math.round(u * hpb),
    });
  }

  const fumingCount = resolveFumingPotatoCount(extra);
  if (fumingCount > 0) {
    const u = instantSell(getProduct(products, "FUMING_POTATO_BOOK"));
    lines.push({
      label:
        fumingCount === 1
          ? "Fuming Potato Book"
          : `Fuming Potato Book (×${fumingCount})`,
      cost: Math.round(u * fumingCount),
    });
  }

  const wetCount = resolveWetBookCount(extra);
  if (wetCount > 0) {
    const u = instantSell(getProduct(products, "WET_BOOK"));
    lines.push({
      label:
        wetCount === 1 ? "Wet Book" : `Wet Book (×${wetCount})`,
      cost: Math.round(u * wetCount),
    });
  }

  if (extra.wood_singularity === true || Number(extra.wood_singularity_count) > 0) {
    const u = instantSell(getProduct(products, "WOOD_SINGULARITY"));
    lines.push({ label: "Wood Singularity", cost: Math.round(u) });
  }

  const modifierRaw = extra.modifier ?? extra.Modifier;
  if (typeof modifierRaw === "string" && modifierRaw.trim()) {
    const resolved = resolveReforgeStoneProduct(modifierRaw, products);
    if (resolved) {
      const u = instantSell(getProduct(products, resolved.productId));
      const m = modifierRaw.trim();
      lines.push({
        label:
          resolved.source === "explicit"
            ? `Reforge stone — ${resolved.productId} (${m})`
            : `Reforge stone — ${resolved.productId} (${m}, suffix match)`,
        cost: Math.round(u),
      });
    }
  }

  const masterStarLine = masterStarCostFromExtra(extra, products, instantSell);
  if (masterStarLine) lines.push(masterStarLine);

  lines.push(...buildGemCostLines(extra, products, instantSell, opts));

  const rodLines = await collectRodAttachmentLines(
    extra,
    products,
    instantSell
  );

  return { lines, rodLines };
}

/** Hypixel fishing rod line / hook / sinker — ExtraAttributes string id (bazaar product id). */
const ROD_SLOT_KEYS: { label: "Line" | "Hook" | "Sinker"; keys: string[] }[] = [
  {
    label: "Line",
    keys: [
      "line",
      "line_id",
      "fishing_line",
      "rod_line",
      "LINE",
      "FISHING_LINE",
      "LINE_PART",
      "line_part",
      "SELECTED_LINE",
      "selected_line",
      "ROD_LINE_PART",
    ],
  },
  {
    label: "Hook",
    keys: [
      "hook",
      "hook_id",
      "fishing_hook",
      "rod_hook",
      "HOOK",
      "FISHING_HOOK",
      "HOOK_PART",
      "hook_part",
      "SELECTED_HOOK",
      "selected_hook",
      "ROD_HOOK_PART",
    ],
  },
  {
    label: "Sinker",
    keys: [
      "sinker",
      "sinker_id",
      "fishing_sinker",
      "rod_sinker",
      "SINKER",
      "FISHING_SINKER",
      "SINKER_PART",
      "sinker_part",
      "SELECTED_SINKER",
      "selected_sinker",
      "ROD_SINKER_PART",
    ],
  },
];

function parseRodPartId(raw: unknown): string | null {
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s || s === "NONE" || s === "none") return null;
    return s.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const id =
      o.id ??
      o.item_id ??
      o.type ??
      o.tag ??
      o.Value ??
      o.value ??
      o.string ??
      o.str;
    if (typeof id === "string" && id.trim()) {
      return id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    }
    if (typeof id === "number" && Number.isFinite(id)) {
      return String(Math.floor(id));
    }
  }
  return null;
}

/**
 * Rod attachments from Roddy (Backwater Bayou): line, hook, sinker — each stored as
 * an internal item id (same as bazaar `product_id` when listed).
 */
function getExtraInsensitive(
  extra: Record<string, unknown>,
  candidates: string[]
): unknown {
  const lower = new Map(
    Object.keys(extra).map((k) => [k.toLowerCase(), k] as const)
  );
  for (const c of candidates) {
    const real = lower.get(c.toLowerCase());
    if (real !== undefined) return extra[real];
  }
  return undefined;
}

/** Some payloads nest line/hook/sinker under a compound tag. */
const ROD_PART_NESTED_CONTAINERS = [
  "rod_upgrades",
  "fishing_rod_upgrades",
  "rod_attachments",
  "attachments",
  "rod_parts",
  "rodParts",
  "fishing_rod",
  "custom_fishing",
  "custom_fishing_data",
  "fishing_data",
  "backwater",
  "applied_parts",
] as const;

/**
 * Depth-first search for a value whose key matches one of `slotKeys` (case-insensitive).
 * Hypixel sometimes nests rod parts several levels under `extraattributes`.
 */
function getRodSlotRawDeep(
  extra: Record<string, unknown>,
  slotKeys: string[],
  maxDepth = 5
): unknown {
  const want = new Set(slotKeys.map((k) => k.toLowerCase()));

  function walk(node: unknown, depth: number): unknown {
    if (depth > maxDepth || node === null || node === undefined) return undefined;
    if (Array.isArray(node)) {
      for (const el of node) {
        const f = walk(el, depth + 1);
        if (f !== undefined) return f;
      }
      return undefined;
    }
    if (typeof node !== "object") return undefined;
    const o = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (want.has(k.toLowerCase()) && v !== undefined && v !== null && v !== "") {
        return v;
      }
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === "object") {
        const f = walk(v, depth + 1);
        if (f !== undefined) return f;
      }
    }
    return undefined;
  }

  for (const k of slotKeys) {
    const v = extra[k] ?? getExtraInsensitive(extra, [k]);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  for (const container of ROD_PART_NESTED_CONTAINERS) {
    const raw = extra[container];
    if (!raw || typeof raw !== "object") continue;
    if (Array.isArray(raw)) {
      const f = walk(raw, 0);
      if (f !== undefined) return f;
      continue;
    }
    const sub = raw as Record<string, unknown>;
    for (const k of slotKeys) {
      const v = sub[k] ?? getExtraInsensitive(sub, [k]);
      if (v !== undefined && v !== null && v !== "") return v;
    }
    const f = walk(sub, 0);
    if (f !== undefined) return f;
  }

  return walk(extra, 0);
}

function getRodSlotRaw(
  extra: Record<string, unknown>,
  slotKeys: string[]
): unknown {
  return getRodSlotRawDeep(extra, slotKeys);
}

type RodSlotLabel = "Line" | "Hook" | "Sinker";

async function rodPartModifierLine(
  slotLabel: RodSlotLabel,
  found: string,
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number
): Promise<ModifierCostLine> {
  const [bin, bz] = await Promise.all([
    fetchLowestBinByTag(found),
    Promise.resolve(Math.round(instantSell(getProduct(products, found)))),
  ]);
  const cost = bin > 0 ? bin : bz;
  let label = `${slotLabel} (${found})`;
  if (bin > 0) label += " — lowest BIN";
  else if (bz > 0) label += " — bazaar instant buy (no BIN)";
  else label += " — no active BIN or bazaar";
  return { label, cost };
}

/** Fallback: find string ids under keys whose path suggests a rod slot (Hypixel naming varies). */
function collectRodPartsFromDeepKeyScan(
  extra: Record<string, unknown>,
  alreadySeen: Set<string>
): { slotLabel: RodSlotLabel; found: string }[] {
  const out: { slotLabel: RodSlotLabel; found: string }[] = [];

  function inferSlot(keyPath: string): RodSlotLabel | null {
    const p = keyPath.toLowerCase();
    if (/hook/.test(p) && !/hooked/.test(p)) return "Hook";
    if (/sinker|chum/i.test(p)) return "Sinker";
    if (
      /(^|\.|_)(line|spool|bobbin|lure|tackle|fishing_line|rod_line|line_id|line_part)(_|\.|$)/i.test(
        p
      ) ||
      /^line$/i.test(p)
    ) {
      if (!/underline|outline|deadline/i.test(p)) return "Line";
    }
    return null;
  }

  function maybeAdd(keyPath: string, raw: unknown) {
    const slot = inferSlot(keyPath);
    if (!slot) return;
    const found = parseRodPartId(raw);
    if (!found) return;
    const dedupe = `${slot}:${found}`;
    if (alreadySeen.has(dedupe)) return;
    alreadySeen.add(dedupe);
    out.push({ slotLabel: slot, found });
  }

  function walk(node: unknown, path: string, depth: number): void {
    if (depth > 6 || node === null || node === undefined) return;
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean")
      return;
    if (Array.isArray(node)) {
      node.forEach((el, i) => walk(el, `${path}[${i}]`, depth + 1));
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      const next = path ? `${path}.${k}` : k;
      if (inferSlot(next) && v !== undefined && v !== null) {
        maybeAdd(next, v);
      }
      if (v && typeof v === "object") walk(v, next, depth + 1);
    }
  }

  walk(extra, "", 0);
  return out;
}

async function collectRodAttachmentLines(
  extra: Record<string, unknown>,
  products: Record<string, BazaarProduct>,
  instantSell: (p: BazaarProduct | undefined) => number
): Promise<ModifierCostLine[]> {
  const seen = new Set<string>();
  const candidates: { slotLabel: RodSlotLabel; found: string }[] = [];

  const pushCandidate = (slotLabel: RodSlotLabel, found: string) => {
    const dedupe = `${slotLabel}:${found}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    candidates.push({ slotLabel, found });
  };

  for (const slot of ROD_SLOT_KEYS) {
    const raw = getRodSlotRaw(extra, slot.keys);
    if (raw === undefined || raw === null || raw === "") continue;

    const found = parseRodPartId(raw);
    if (!found) continue;

    pushCandidate(slot.label, found);
  }

  candidates.push(...collectRodPartsFromDeepKeyScan(extra, seen));

  return Promise.all(
    candidates.map((c) =>
      rodPartModifierLine(c.slotLabel, c.found, products, instantSell)
    )
  );
}

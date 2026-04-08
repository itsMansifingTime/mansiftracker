import type { CoflAuctionEnchant } from "./coflnet";

/**
 * Hypixel may store level as number, string, bigint, or `{ lvl, level }` (NBT simplify).
 */
function coerceEnchantLevel(v: unknown, depth = 0): number | null {
  if (depth > 4) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const n = Number.parseFloat(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const inner =
      o.lvl ?? o.level ?? o.Level ?? o.Lvl ?? o.tier ?? o.Tier;
    if (inner !== undefined && inner !== null) {
      return coerceEnchantLevel(inner, depth + 1);
    }
  }
  return null;
}

function normalizeEnchantKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_");
}

function clampTier(level: number): number {
  const n = Math.round(level);
  return Math.min(10, Math.max(1, n));
}

function addEnchant(
  map: Map<string, number>,
  typeKey: string,
  levelRaw: unknown
): void {
  const level = coerceEnchantLevel(levelRaw);
  if (level === null) return;
  const tier = clampTier(level);
  const type = normalizeEnchantKey(typeKey);
  if (!type) return;
  const prev = map.get(type) ?? 0;
  if (tier > prev) map.set(type, tier);
}

function parseEnchantArray(
  map: Map<string, number>,
  arr: unknown[]
): void {
  for (const entry of arr) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const id =
      e.id ??
      e.type ??
      e.Type ??
      e.enchantment ??
      e.name ??
      e.key;
    if (typeof id !== "string" || !id.trim()) continue;
    const lvl = e.lvl ?? e.level ?? e.Level ?? e.Lvl ?? e.tier;
    addEnchant(map, id, lvl);
  }
}

/**
 * Hypixel `ExtraAttributes.enchantments` is usually an object:
 * `{ "ultimate_flash": 5, "sharpness": 7 }` (keys often snake_case).
 * Also supports list-shaped payloads and nested `{ lvl: 7 }` values.
 */
export function parseEnchantmentsFromExtraAttributes(
  extra: Record<string, unknown>
): CoflAuctionEnchant[] {
  const raw = extra.enchantments ?? extra.Enchantments;
  if (raw == null) return [];

  const map = new Map<string, number>();

  if (Array.isArray(raw)) {
    parseEnchantArray(map, raw);
  } else if (typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (Array.isArray(v)) {
        parseEnchantArray(map, v);
        continue;
      }
      addEnchant(map, k, v);
    }
  }

  const out: CoflAuctionEnchant[] = [];
  for (const [type, level] of map) {
    out.push({ type, level });
  }
  return out;
}

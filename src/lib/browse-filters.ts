/**
 * Browse page filter catalog + server-side application against `ended_auctions`.
 * Uses generated column `extra_attributes` (ExtraAttributes NBT slice).
 */

export const RARITY_OPTIONS = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
  "DIVINE",
  "SPECIAL",
] as const;

export type BrowseFilterOptionMeta = {
  id: string;
  label: string;
  kind:
    | "bool"
    | "enum"
    | "text"
    | "int"
    | "enchant"
    | "nbt"
    | "dye"
    | "rune"
    | "skin";
};

export const BROWSE_FILTER_OPTIONS: BrowseFilterOptionMeta[] = [
  { id: "rarity", label: "Rarity", kind: "enum" },
  { id: "reforge", label: "Reforge", kind: "text" },
  { id: "stars", label: "Stars", kind: "int" },
  { id: "bin", label: "Bin", kind: "bool" },
  { id: "sold", label: "Sold", kind: "bool" },
  { id: "highest_bid", label: "HighestBid", kind: "int" },
  { id: "recombobulated", label: "Recombobulated", kind: "bool" },
  { id: "soulbound", label: "Soulbound", kind: "bool" },
  { id: "has_dye", label: "Dye (any)", kind: "bool" },
  { id: "has_rune", label: "Rune (any)", kind: "bool" },
  { id: "has_skin", label: "Skin (any)", kind: "bool" },
  { id: "min_hpc", label: "Min hot potatoes (hpc)", kind: "int" },
  { id: "min_fuming", label: "Min fuming potatoes", kind: "int" },
  { id: "enchant", label: "Enchant", kind: "enchant" },
  { id: "dye", label: "Dye", kind: "dye" },
  { id: "rune", label: "Rune", kind: "rune" },
  { id: "skin", label: "Skin", kind: "skin" },
  { id: "nbt_field", label: "NBT field (present)", kind: "nbt" },
];

/** Legacy bookmarked filter JSON (before generic enchant). */
const LEGACY_ENCHANT_TO_KEY: Record<string, string> = {
  ultimate_duplex: "ultimate_duplex",
  divine_gift: "divine_gift",
  ultimate_fatal_tempo: "ultimate_fatal_tempo",
};

export type ActiveBrowseFilter =
  | { id: "rarity"; value: string }
  | { id: "reforge"; value: string }
  | { id: "stars"; value: number }
  | { id: "bin"; value: boolean }
  | { id: "sold"; value: boolean }
  | { id: "highest_bid"; value: number }
  | { id: "recombobulated"; value: boolean }
  | { id: "soulbound"; value: boolean }
  | { id: "has_dye"; value: boolean }
  | { id: "has_rune"; value: boolean }
  | { id: "has_skin"; value: boolean }
  | { id: "min_hpc"; value: number }
  | { id: "min_fuming"; value: number }
  | { id: "enchant"; key: string }
  | { id: "dye"; key: string }
  | { id: "rune"; key: string }
  | { id: "skin"; key: string }
  | { id: "nbt_field"; key: string };

/** Safe JSON key under ExtraAttributes / enchantments (Hypixel: snake_case). */
export function sanitizeEnchantKey(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{1,64}$/.test(t)) return null;
  return t;
}

/** Dye / rune / skin ids as Hypixel stores them (often SCREAMING_SNAKE_CASE). */
export function sanitizeCosmeticKey(raw: string): string | null {
  const t = raw.trim();
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(t)) return null;
  return t;
}

export function parseBrowseFiltersParam(raw: string | null): ActiveBrowseFilter[] {
  if (!raw || typeof raw !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ActiveBrowseFilter[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const id = (entry as { id?: unknown }).id;
    if (typeof id !== "string") continue;

    const legacyKey = LEGACY_ENCHANT_TO_KEY[id];
    if (legacyKey) {
      out.push({ id: "enchant", key: legacyKey });
      continue;
    }

    if (id === "enchant") {
      const key = (entry as { key?: unknown }).key;
      if (typeof key !== "string") continue;
      const k = sanitizeEnchantKey(key);
      if (!k) continue;
      out.push({ id: "enchant", key: k });
      continue;
    }

    if (id === "nbt_field") {
      const key = (entry as { key?: unknown }).key;
      if (typeof key !== "string") continue;
      const k = sanitizeEnchantKey(key);
      if (!k) continue;
      out.push({ id: "nbt_field", key: k });
      continue;
    }

    if (id === "enchant_custom") {
      const v = (entry as { value?: unknown }).value;
      if (typeof v !== "string") continue;
      const k = sanitizeEnchantKey(v);
      if (!k) continue;
      out.push({ id: "enchant", key: k });
      continue;
    }

    if (id === "dye" || id === "rune" || id === "skin") {
      const key = (entry as { key?: unknown }).key;
      if (typeof key !== "string") continue;
      const k = sanitizeCosmeticKey(key);
      if (!k) continue;
      out.push({ id, key: k });
      continue;
    }

    const meta = BROWSE_FILTER_OPTIONS.find((o) => o.id === id);
    if (!meta) continue;

    const v = (entry as { value?: unknown }).value;
    if (meta.kind === "bool") {
      if (typeof v !== "boolean") continue;
      if (id === "bin") out.push({ id: "bin", value: v });
      else if (id === "sold") out.push({ id: "sold", value: v });
      else if (id === "recombobulated")
        out.push({ id: "recombobulated", value: v });
      else if (id === "soulbound") out.push({ id: "soulbound", value: v });
      else if (id === "has_dye") out.push({ id: "has_dye", value: v });
      else if (id === "has_rune") out.push({ id: "has_rune", value: v });
      else if (id === "has_skin") out.push({ id: "has_skin", value: v });
      continue;
    }
    if (meta.kind === "enum" && id === "rarity") {
      if (typeof v !== "string") continue;
      const u = v.toUpperCase();
      if (!RARITY_OPTIONS.includes(u as (typeof RARITY_OPTIONS)[number])) continue;
      out.push({ id: "rarity", value: u });
      continue;
    }
    if (meta.kind === "text" && id === "reforge") {
      if (typeof v !== "string") continue;
      const t = v.trim();
      if (!t) continue;
      out.push({ id: "reforge", value: t });
      continue;
    }
    if (meta.kind === "int") {
      if (id === "stars") {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) continue;
        const i = Math.floor(n);
        if (i < 0 || i > 15) continue;
        out.push({ id: "stars", value: i });
        continue;
      }
      if (id === "highest_bid") {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) continue;
        const i = Math.max(0, Math.floor(n));
        if (i <= 0) continue;
        out.push({ id: "highest_bid", value: i });
        continue;
      }
      if (id === "min_hpc") {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) continue;
        const i = Math.max(0, Math.floor(n));
        if (i > 64) continue;
        out.push({ id: "min_hpc", value: i });
        continue;
      }
      if (id === "min_fuming") {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) continue;
        const i = Math.max(0, Math.floor(n));
        if (i > 64) continue;
        out.push({ id: "min_fuming", value: i });
      }
    }
  }
  return out;
}

export function escapeIlikeFragment(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Apply validated filters to a PostgREST query on `ended_auctions`. */
export function applyBrowseFiltersToQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: ActiveBrowseFilter[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let q = query;
  for (const f of filters) {
    switch (f.id) {
      case "bin":
        q = q.eq("bin", f.value);
        break;
      case "sold":
        if (f.value) q = q.not("buyer_uuid", "is", null);
        else q = q.is("buyer_uuid", null);
        break;
      case "has_dye":
        if (f.value) {
          q = q.not("extra_attributes->>dye", "is", null);
          q = q.neq("extra_attributes->>dye", "");
        } else {
          q = q.or(
            "extra_attributes->>dye.is.null,extra_attributes->>dye.eq."
          );
        }
        break;
      case "has_rune":
        if (f.value) {
          q = q.not("extra_attributes->runes", "is", null);
          q = q.neq("extra_attributes->runes", {});
        } else {
          q = q.or(
            "extra_attributes->runes.is.null,extra_attributes->runes.eq.{}"
          );
        }
        break;
      case "has_skin":
        if (f.value) {
          q = q.not("extra_attributes->>skin", "is", null);
          q = q.neq("extra_attributes->>skin", "");
        } else {
          q = q.or(
            "extra_attributes->>skin.is.null,extra_attributes->>skin.eq."
          );
        }
        break;
      case "rarity":
        q = q.ilike("item_rarity", escapeIlikeFragment(f.value));
        break;
      case "reforge": {
        const p = `%${escapeIlikeFragment(f.value)}%`;
        q = q.ilike("extra_attributes->>modifier", p);
        break;
      }
      case "stars":
        q = q.eq("item_upgrade_level", f.value);
        break;
      case "highest_bid":
        q = q.gte("price", f.value);
        break;
      case "recombobulated":
        if (f.value) {
          q = q.gte("extra_attributes->rarity_upgrades", 1);
        } else {
          q = q.or(
            "extra_attributes->rarity_upgrades.is.null,extra_attributes->rarity_upgrades.lt.1"
          );
        }
        break;
      case "soulbound":
        if (f.value) {
          q = q.eq("extra_attributes->soulbound", true);
        } else {
          q = q.or(
            "extra_attributes->soulbound.is.null,extra_attributes->soulbound.eq.false"
          );
        }
        break;
      case "min_hpc":
        q = q.gte("extra_attributes->hpc", f.value);
        break;
      case "min_fuming":
        q = q.gte("extra_attributes->fuming_potato_count", f.value);
        break;
      case "enchant": {
        const k = sanitizeEnchantKey(f.key);
        if (k) {
          q = q.not(`extra_attributes->enchantments->${k}`, "is", null);
        }
        break;
      }
      case "nbt_field": {
        const k = sanitizeEnchantKey(f.key);
        if (k) {
          q = q.not(`extra_attributes->${k}`, "is", null);
        }
        break;
      }
      case "dye": {
        const k = sanitizeCosmeticKey(f.key);
        if (k) {
          q = q.eq("extra_attributes->>dye", k);
        }
        break;
      }
      case "rune": {
        const k = sanitizeCosmeticKey(f.key);
        if (k) {
          q = q.not(`extra_attributes->runes->${k}`, "is", null);
        }
        break;
      }
      case "skin": {
        const k = sanitizeCosmeticKey(f.key);
        if (k) {
          q = q.eq("extra_attributes->>skin", k);
        }
        break;
      }
      default:
        break;
    }
  }
  return q;
}

export function serializeBrowseFiltersForApi(
  filters: ActiveBrowseFilter[]
): string {
  const cleaned = filters.filter(
    (f) =>
      !(f.id === "reforge" && (!f.value || !f.value.trim())) &&
      !(f.id === "enchant" && !sanitizeEnchantKey(f.key)) &&
      !(f.id === "nbt_field" && !sanitizeEnchantKey(f.key)) &&
      !(
        (f.id === "dye" || f.id === "rune" || f.id === "skin") &&
        !sanitizeCosmeticKey(f.key)
      )
  );
  return JSON.stringify(cleaned);
}

export function defaultNewFilter(id: string): ActiveBrowseFilter | null {
  const meta = BROWSE_FILTER_OPTIONS.find((o) => o.id === id);
  if (!meta) return null;
  switch (meta.kind) {
    case "bool":
      if (id === "bin") return { id: "bin", value: true };
      if (id === "sold") return { id: "sold", value: true };
      if (id === "recombobulated") return { id: "recombobulated", value: true };
      if (id === "soulbound") return { id: "soulbound", value: true };
      if (id === "has_dye") return { id: "has_dye", value: true };
      if (id === "has_rune") return { id: "has_rune", value: true };
      if (id === "has_skin") return { id: "has_skin", value: true };
      return null;
    case "enum":
      return { id: "rarity", value: "LEGENDARY" };
    case "text":
      return { id: "reforge", value: "" };
    case "int":
      if (id === "stars") return { id: "stars", value: 5 };
      if (id === "highest_bid") return { id: "highest_bid", value: 50_000_000 };
      if (id === "min_hpc") return { id: "min_hpc", value: 10 };
      if (id === "min_fuming") return { id: "min_fuming", value: 1 };
      return null;
    case "enchant":
      return { id: "enchant", key: "" };
    case "dye":
      return { id: "dye", key: "" };
    case "rune":
      return { id: "rune", key: "" };
    case "skin":
      return { id: "skin", key: "" };
    case "nbt":
      return { id: "nbt_field", key: "" };
    default:
      return null;
  }
}

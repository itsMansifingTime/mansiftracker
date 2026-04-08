/** Bazaar product ids for Hyperion WIMP (matches ExtraAttributes scroll ids). */
export const WIMP_SCROLL_PRODUCT_IDS = [
  "WITHER_SHIELD_SCROLL",
  "SHADOW_WARP_SCROLL",
  "IMPLOSION_SCROLL",
] as const;

export type WimpScrollProductId = (typeof WIMP_SCROLL_PRODUCT_IDS)[number];

const WIMP_SET = new Set<string>(WIMP_SCROLL_PRODUCT_IDS);

const LABEL: Record<WimpScrollProductId, string> = {
  WITHER_SHIELD_SCROLL: "Wither Shield",
  SHADOW_WARP_SCROLL: "Shadow Warp",
  IMPLOSION_SCROLL: "Implosion",
};

export function wimpScrollLabel(productId: WimpScrollProductId): string {
  return LABEL[productId];
}

function normalizeAbilityScrollEntry(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => normalizeAbilityScrollEntry(x));
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.id === "string") {
      return normalizeAbilityScrollEntry(o.id);
    }
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    if (s.includes(",") || s.includes(";")) {
      return s
        .split(/[,;]/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [s];
  }
  return [];
}

function normalizeToProductId(s: string): string | null {
  let u = s.trim().toUpperCase().replace(/\s+/g, "_");
  if (WIMP_SET.has(u)) return u;
  if (!u.endsWith("_SCROLL")) u = `${u}_SCROLL`;
  if (WIMP_SET.has(u)) return u;
  return null;
}

/**
 * Collect raw `ability_scroll` payloads from Cofl auction JSON (flatNbt + nbtData.data).
 */
function collectAbilityScrollRaw(
  auction: {
    flatNbt?: Record<string, string | number>;
    nbtData?: { data?: Record<string, unknown> };
  }
): { found: boolean; values: unknown[] } {
  const values: unknown[] = [];
  let found = false;

  const flat = auction.flatNbt as Record<string, unknown> | undefined;
  if (flat) {
    if (Object.prototype.hasOwnProperty.call(flat, "ability_scroll")) {
      found = true;
      values.push(flat["ability_scroll"]);
    }
    for (const [k, v] of Object.entries(flat)) {
      if (/^ability_scroll_\d+$/i.test(k)) {
        found = true;
        values.push(v);
      }
    }
  }

  const data = auction.nbtData?.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(d, "ability_scroll")) {
      found = true;
      values.push(d["ability_scroll"]);
    }
    const extra = d.extra_attributes;
    if (extra && typeof extra === "object") {
      const ex = extra as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(ex, "ability_scroll")) {
        found = true;
        values.push(ex["ability_scroll"]);
      }
    }
  }

  return { found, values };
}

export type HyperionWimpScrollsResult =
  | { status: "unknown" }
  | { status: "listed"; scrolls: WimpScrollProductId[] };

/**
 * Determine which WIMP scrolls are on the item from NBT.
 * - `unknown`: no `ability_scroll` field in the payload (cannot tell — do not assume all three).
 * - `listed`: field was present; `scrolls` lists applied WIMP (may be empty).
 */
export function getHyperionWimpScrollsFromAuction(auction: {
  flatNbt?: Record<string, string | number>;
  nbtData?: { data?: Record<string, unknown> };
}): HyperionWimpScrollsResult {
  const { found, values } = collectAbilityScrollRaw(auction);
  if (!found) {
    return { status: "unknown" };
  }

  const seen = new Set<WimpScrollProductId>();
  for (const v of values) {
    for (const piece of normalizeAbilityScrollEntry(v)) {
      const id = normalizeToProductId(piece);
      if (id && WIMP_SET.has(id)) {
        seen.add(id as WimpScrollProductId);
      }
    }
  }

  return { status: "listed", scrolls: [...seen] };
}

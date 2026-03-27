import { gunzipSync } from "node:zlib";
import * as nbt from "prismarine-nbt";

export type DecodedItemBytes = {
  /** SkyBlock `ExtraAttributes.id` (e.g. LUSH_ARTIFACT, HYPERION). */
  itemId: string | null;
  /** `display.Name` with § color codes stripped. */
  itemName: string | null;
  /** SkyBlock `ExtraAttributes.uuid` when present. */
  itemUuid: string | null;
  /** Legacy numeric item id in NBT (e.g. 397 for skull). */
  minecraftItemId: number | null;
  /**
   * Entire simplified NBT root from prismarine-nbt (everything decodable:
   * ExtraAttributes enchants, runes, dye, recombob, HPB, etc. as Hypixel stores them).
   */
  fullNbt: Record<string, unknown> | unknown[] | null;
};

/** Max JSON string length stored in DB (avoid multi‑MB rows). */
const MAX_FULL_NBT_JSON_CHARS = 5_000_000;

export function stripMinecraftColorCodes(s: string): string {
  return s.replace(/§./g, "");
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return { __bufferBase64: value.toString("base64") };
  }
  return value;
}

/**
 * Clone NBT simplify output into JSON-serializable structure for JSONB storage.
 */
export function toJsonSafeRoot(
  value: unknown
): Record<string, unknown> | unknown[] | null {
  if (value === undefined || value === null) return null;
  try {
    const s = JSON.stringify(value, jsonReplacer);
    if (s.length > MAX_FULL_NBT_JSON_CHARS) return null;
    const parsed = JSON.parse(s) as Record<string, unknown> | unknown[];
    return parsed;
  } catch {
    return null;
  }
}

function extractFromSimplifiedRoot(
  s: unknown
): Omit<DecodedItemBytes, "fullNbt"> {
  const empty: Omit<DecodedItemBytes, "fullNbt"> = {
    itemId: null,
    itemName: null,
    itemUuid: null,
    minecraftItemId: null,
  };
  if (!s || typeof s !== "object") return empty;
  const root = s as Record<string, unknown>;

  let item: Record<string, unknown> | undefined;
  if (Array.isArray(root.i) && root.i.length > 0) {
    item = root.i[0] as Record<string, unknown>;
  } else if (root.tag && typeof root.tag === "object") {
    item = root;
  }
  if (!item) return empty;

  const minecraftItemId =
    typeof item.id === "number"
      ? item.id
      : typeof item.id === "string"
        ? Number.parseInt(item.id, 10)
        : null;
  const minecraftItemIdNorm =
    minecraftItemId !== null && Number.isFinite(minecraftItemId)
      ? minecraftItemId
      : null;

  const tag = item.tag as Record<string, unknown> | undefined;
  if (!tag) {
    return { ...empty, minecraftItemId: minecraftItemIdNorm };
  }

  const extra = tag.ExtraAttributes as Record<string, unknown> | undefined;
  const display = tag.display as Record<string, unknown> | undefined;

  const itemId =
    extra && typeof extra.id === "string" ? extra.id : null;
  const itemUuid =
    extra && typeof extra.uuid === "string" ? extra.uuid : null;

  const nameRaw =
    display && typeof display.Name === "string" ? display.Name : null;
  const itemName = nameRaw ? stripMinecraftColorCodes(nameRaw) : null;

  return {
    itemId,
    itemName,
    itemUuid,
    minecraftItemId: minecraftItemIdNorm,
  };
}

/**
 * Decodes Hypixel `item_bytes`: base64 → gzip → NBT → full simplified tree + summary fields.
 * `fullNbt` holds everything (enchants, runes, etc.) as in NBT; summary columns duplicate a few for fast queries.
 */
/**
 * Hypixel `auctions_ended` sends `item_bytes` as a base64 string; active
 * `/skyblock/auctions` sends `{ type, data }` where `data` is base64.
 */
export function normalizeHypixelItemBytesRaw(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    typeof (raw as { data: unknown }).data === "string"
  ) {
    return (raw as { data: string }).data;
  }
  return null;
}

export async function decodeSkyblockItemBytes(
  base64: string | null | undefined
): Promise<DecodedItemBytes> {
  const empty: DecodedItemBytes = {
    itemId: null,
    itemName: null,
    itemUuid: null,
    minecraftItemId: null,
    fullNbt: null,
  };
  if (!base64 || typeof base64 !== "string") return empty;

  let buf: Buffer;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return empty;
  }

  let inflated: Buffer;
  try {
    inflated = gunzipSync(buf);
  } catch {
    return empty;
  }

  const tryParse = async (endian: "big" | "little") => {
    const result = await nbt.parse(inflated, endian);
    return nbt.simplify(result.parsed);
  };

  try {
    const simplified = await tryParse("big");
    return {
      ...extractFromSimplifiedRoot(simplified),
      fullNbt: toJsonSafeRoot(simplified),
    };
  } catch {
    try {
      const simplified = await tryParse("little");
      return {
        ...extractFromSimplifiedRoot(simplified),
        fullNbt: toJsonSafeRoot(simplified),
      };
    } catch {
      return empty;
    }
  }
}

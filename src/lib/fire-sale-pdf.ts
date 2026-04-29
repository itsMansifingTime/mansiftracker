import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pdf from "pdf-parse/lib/pdf-parse";
import { getCached, setCached } from "./cache";
import { getSupabaseAdmin } from "./supabase-admin";

const PDF_CACHE_MS = 5 * 60_000;
const COFL_CACHE_MS = 60 * 60_000;
const COFL_MEDIAN_CACHE_MS = 7 * 24 * 60 * 60_000;
const COFL_MISS_CACHE_MS = 2 * 60_000;
const COFL_TIMEOUT_MS = 15_000;
const COFL_RETRY_DELAY_MS = 350;

const DEFAULT_FIRE_SALE_PDF_PATH =
  "C:\\Users\\alexl\\Downloads\\Mansif Skins - Fire Sales.pdf";

export type FireSaleSkinRow = {
  owned: boolean;
  cosmetic: string;
  year: number;
  dateAvailable: string;
  stock: string;
  sheetPrice: number;
};

export type FireSaleSkinPriceRow = FireSaleSkinRow & {
  coflTag: string | null;
  monthlyMedian: number | null;
  finalPrice: number | null;
  priceSource: "manual_override" | "cofl_monthly_median" | "missing";
};

const MANUAL_PRICE_OVERRIDES: Record<string, number> = {
  "Derpy Rock Skin": 5_500_000_000,
  "Embarrassed Rock Skin": 6_000_000_000,
  "Smiling Rock Skin": 3_500_000_000,
  "Laughing Rock Skin": 6_000_000_000,
  "Thinking Rock Skin": 4_000_000_000,
  "Cool Rock Skin": 3_000_000_000,
  "Shimmer Skin (Unstable)": 500_000_000,
  "Shimmer Skin (Holy)": 500_000_000,
  "Shimmer Skin (Old)": 500_000_000,
  "Neon Yellow Sheep Skin": 1_500_000_000,
  "Neon Red Sheep Skin": 1_500_000_000,
  "Neon Green Sheep Skin": 1_400_000_000,
  "Neon Blue Sheep Skin": 2_000_000_000,
  "Pink Elephant Skin": 2_000_000_000,
  "Blue Elephant Skin": 2_000_000_000,
  "Orange Elephant Skin": 2_000_000_000,
  "Baby Skin (Wise)": 5_000_000_000,
  "Baby Skin (Young)": 4_000_000_000,
  "Baby Skin (Strong)": 3_000_000_000,
  "Red Elf Jerry Skin": 2_000_000_000,
  "Green Elf Jerry Skin": 2_000_000_000,
  "White Sheep Skin": 4_600_000_000,
  "Light Blue Sheep Skin": 7_100_000_000,
  "Light Green Sheep Skin": 5_800_000_000,
  "Purple Sheep Skin": 7_250_000_000,
  "Pink Sheep Skin": 9_600_000_000,
  "Black Sheep Skin": 13_500_000_000,
  "Baby Skin (Superior)": 2_000_000_000,
  "Pretty Rabbit Skin": 1_500_000_000,
  "Puppy Skin": 700_000_000,
  "Watcher Guardian Skin": 1_200_000_000,
  "Icicle Skin": 500_000_000,
  "Twilight Tiger Skin": 3_000_000_000,
  "Baby Skin (Old)": 3_000_000_000,
  "Baby Skin (Holy)": 3_000_000_000,
  "Baby Skin (Unstable)": 5_000_000_000,
  "Dark Wither Skeleton Skin": 650_000_000,
  "Fortified Silverfish Skin": 200_000_000,
  "Grown-up Baby Yeti Skin": 1_500_000_000,
  "Zombie Skeleton Horse Skin": 300_000_000,
  "Neon Red Ender Dragon Skin": 400_000_000,
  "Neon Purple Ender Dragon Skin": 400_000_000,
  "Neon Blue Ender Dragon Skin": 400_000_000,
  "Red Elephant Skin": 500_000_000,
  "Purple Elephant Skin": 500_000_000,
  "Green Elephant Skin": 500_000_000,
  "Crowned Rune III": 44_144_673,
  "Turkey Rune III": 32_971_999,
  "Peafowl Rune III": 38_292_214,
  "Great Gats Bee Skin": 350_000_000,
  "BeeDazzled Bee Skin": 82_000_000,
  "WasaBee Bee Skin": 285_000_000,
  "Plushie Reindeer Skin": 50_000_000,
  "Sun Enderman Skin": 50_000_000,
  "Shimmer Skin (Protector)": 1_400_000_000,
  "Enchanted Armadillo Skin": 150_000_000,
  "Radiant Endermite Skin": 87_000_000,
  "Rat-stronaut Rat Skin": 90_000_000,
  "Reindeer Backpack Skin": 20_000_000,
  "Fading Rainbow Rune III": 45_000_000,
  "Baby Skin": 50_000_000,
  "Black Widow Skin": 500_000_000,
  "Spooky Enderman Skin": 1_300_000_000,
};

export type FireSaleSkinSnapshot = {
  generatedAt: string;
  rows: FireSaleSkinPriceRow[];
};

type FireSaleUserOwnershipSnapshot = {
  savedAt: string;
  ownedKeys: string[];
};

type FireSaleUserOwnershipStore = Record<string, FireSaleUserOwnershipSnapshot>;
export type FireSaleUserOwnershipSummary = {
  username: string;
  savedAt: string;
  ownedCount: number;
};

type CoflSearchResult = {
  name: string;
  id: string;
  type?: string;
};
type CoflItemMetadata = {
  name: string | null;
  tag: string;
  flags?: string;
};

type CoflMonthlyHistoryPoint = {
  avg: number;
  volume?: number;
};

type PersistentMedianCache = Record<string, number>;
let persistentMedianCache: PersistentMedianCache | null = null;

function getPersistentMedianCachePath(): string {
  return join(process.cwd(), "data", "cofl-median-cache.json");
}

async function loadPersistentMedianCache(): Promise<PersistentMedianCache> {
  if (persistentMedianCache) return persistentMedianCache;
  const path = getPersistentMedianCachePath();
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as PersistentMedianCache;
    persistentMedianCache = parsed && typeof parsed === "object" ? parsed : {};
    return persistentMedianCache;
  } catch {
    persistentMedianCache = {};
    return persistentMedianCache;
  }
}

async function getPersistedMedian(tag: string): Promise<number | null> {
  const cache = await loadPersistentMedianCache();
  const value = cache[tag];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

async function setPersistedMedian(tag: string, median: number): Promise<void> {
  const cache = await loadPersistentMedianCache();
  cache[tag] = median;
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(getPersistentMedianCachePath(), JSON.stringify(cache, null, 2), "utf8");
}

function normalizeCosmeticName(name: string): string {
  const overrides: Record<string, string> = {
    "Teal Skin": "Teal Space Skin",
    "Red Skin": "Red Space Skin",
    "Black Ice Skin": "Black Ice Space Skin",
  };
  return overrides[name] ?? name;
}

function getManualCoflTags(name: string): string[] {
  const direct: Record<string, string[]> = {
    "Warped Giraffe Skin": ["PET_SKIN_GIRAFFE_WARPED"],
    "Glacial Hedgehog Skin": ["PET_SKIN_HEDGEHOG_GLACIAL"],
    "Celestial Maxor Skin": ["MAXOR_CELESTIAL"],
    "Celestial Goldor Skin": ["GOLDOR_CELESTIAL"],
    "Celestial Necron Skin": ["NECRON_CELESTIAL"],
    "Celestial Storm Skin": ["STORM_CELESTIAL"],
    "Light Green Sheep Skin": ["PET_SKIN_SHEEP_LIGHT_GREEN"],
    "Light Blue Sheep Skin": ["PET_SKIN_SHEEP_LIGHT_BLUE", "PET_SKIN_SHEEP_BLUE"],
    "Blue Sheep Skin": ["PET_SKIN_SHEEP_BLUE", "PET_SKIN_SHEEP_LIGHT_BLUE"],
    "Pretty Rabbit Skin": ["PET_SKIN_RABBIT"],
    "Fading Rainbow Rune III": ["AXE_RAINBOW:3"],
    "Crowned Rune III": ["CROWNED_RUNE;3"],
    "Turkey Rune III": ["TURKEY_RUNE;3"],
    "Peafowl Rune III": ["PEAFOWL_RUNE;3"],
  };
  if (direct[name]) return direct[name];

  const shimmer = name.match(/^Shimmer Skin \(([^)]+)\)$/);
  if (shimmer) {
    const k = shimmer[1].trim().toUpperCase();
    return [`${k}_SHIMMER`];
  }

  const baby = name.match(/^Baby Skin \(([^)]+)\)$/);
  if (baby) {
    const k = baby[1].trim().toUpperCase();
    return [`${k}_BABY`];
  }

  return [];
}

async function loadCoflItemsCatalog(): Promise<CoflItemMetadata[]> {
  const cacheKey = "fire-sale:cofl-items-catalog:v1";
  const cached = getCached<CoflItemMetadata[]>(cacheKey);
  if (cached !== undefined) return cached;

  const list = await fetchJsonWithTimeout<CoflItemMetadata[]>(
    "https://sky.coflnet.com/api/items"
  );
  const out = Array.isArray(list) ? list : [];
  setCached(cacheKey, out, COFL_CACHE_MS);
  return out;
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T | null> {
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COFL_TIMEOUT_MS);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) {
        const retryableStatus =
          res.status >= 500 || res.status === 429 || res.status === 403;
        if (attempt < attempts && retryableStatus) {
          await new Promise((resolve) =>
            setTimeout(resolve, COFL_RETRY_DELAY_MS * attempt)
          );
          continue;
        }
        return null;
      }
      return (await res.json()) as T;
    } catch {
      if (attempt >= attempts) return null;
      await new Promise((resolve) =>
        setTimeout(resolve, COFL_RETRY_DELAY_MS * attempt)
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

function parseSheetPrice(value: string): number | null {
  const n = Number.parseInt(value.replaceAll(",", "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseStockAndPrice(value: string): { stock: string; sheetPrice: number } | null {
  const candidates = [
    "2,000",
    "1,800",
    "1,500",
    "1,350",
    "2000",
    "1800",
    "1500",
    "1350",
    "950",
    "750",
    "650",
    "375",
  ];
  for (const candidate of candidates) {
    if (!value.endsWith(candidate)) continue;
    const stockRaw = value.slice(0, -candidate.length).replaceAll(",", "").trim();
    const price = parseSheetPrice(candidate);
    const stockN = Number.parseInt(stockRaw, 10);
    if (!price || !Number.isFinite(stockN) || stockN <= 0) continue;
    return { stock: String(stockN), sheetPrice: price };
  }
  return null;
}

function parseSkinRows(text: string): FireSaleSkinRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows: FireSaleSkinRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const status = lines[i];
    if (status !== "☑ Owned" && status !== "☐ Not owned") {
      continue;
    }

    const body = lines[i + 1] ?? "";
    if (!body.includes("Skin") && !body.includes("Rune")) {
      continue;
    }
    const parts = body.match(
      /^(.*?)(\d{4})([A-Za-z]+\s+\d{1,2},\s+\d{4})([\d,]+)$/
    );
    if (!parts) continue;

    const cosmetic = normalizeCosmeticName(parts[1].trim());
    const year = Number.parseInt(parts[2], 10);
    const dateAvailable = parts[3].trim();
    const stockAndPrice = parts[4].trim();

    const parsedStockPrice = parseStockAndPrice(stockAndPrice);
    if (!parsedStockPrice || !cosmetic) continue;

    rows.push({
      owned: status === "☑ Owned",
      cosmetic,
      year,
      dateAvailable,
      stock: parsedStockPrice.stock,
      sheetPrice: parsedStockPrice.sheetPrice,
    });

    i += 1;
  }

  return rows;
}

export async function loadFireSaleSkinsFromPdf(
  pdfPath = process.env.FIRE_SALES_PDF_PATH ?? DEFAULT_FIRE_SALE_PDF_PATH
): Promise<FireSaleSkinRow[]> {
  const cacheKey = `fire-sale:skins:v4:${pdfPath}`;
  const cached = getCached<FireSaleSkinRow[]>(cacheKey);
  if (cached) return cached;

  const buf = await readFile(pdfPath);
  const parsed = await pdf(buf);
  const rows = parseSkinRows(parsed.text);
  setCached(cacheKey, rows, PDF_CACHE_MS);
  return rows;
}

async function resolveCoflCandidateTags(name: string): Promise<string[]> {
  const cacheKey = `fire-sale:cofl-candidates:v2:${name.toLowerCase()}`;
  const cached = getCached<string[]>(cacheKey);
  if (cached !== undefined) return cached;

  const tagSet = new Set<string>();

  for (const tag of getManualCoflTags(name)) {
    tagSet.add(tag);
  }

  // Most reliable source: full item catalog name -> tag mapping.
  const catalog = await loadCoflItemsCatalog();
  for (const item of catalog) {
    if (typeof item.name !== "string") continue;
    if (item.name.toLowerCase() === name.toLowerCase()) {
      tagSet.add(item.tag);
    }
  }

  const candidates = [name];
  if (name.endsWith(" Skin")) candidates.push(name.slice(0, -5).trim());

  for (const candidate of candidates) {
    const url = `https://sky.coflnet.com/api/item/search/${encodeURIComponent(candidate)}?expectedResults=20`;
    const list = await fetchJsonWithTimeout<CoflSearchResult[]>(url);
    if (!Array.isArray(list) || list.length === 0) continue;

    for (const x of list) {
      if (x.type !== "item" && x.type != null) continue;
      if (x.name.toLowerCase() === name.toLowerCase()) tagSet.add(x.id);
    }
    for (const x of list) {
      if (x.type !== "item" && x.type != null) continue;
      if (
        x.name.toLowerCase().replace(/\s+skin$/, "") ===
        name.toLowerCase().replace(/\s+skin$/, "")
      ) {
        tagSet.add(x.id);
      }
    }
    for (const x of list) {
      if (x.type !== "item" && x.type != null) continue;
      tagSet.add(x.id);
    }
  }

  const out = [...tagSet];
  // Keep negative/empty results short-lived so transient API issues do not
  // pin items to sheet fallback for an hour.
  setCached(cacheKey, out, out.length > 0 ? COFL_CACHE_MS : COFL_MISS_CACHE_MS);
  return out;
}

async function fetchMonthlyMedianByTag(tag: string): Promise<number | null> {
  const cacheKey = `fire-sale:cofl-median30:v8:${tag}`;
  const cached = getCached<number | null>(cacheKey);
  if (typeof cached === "number" && Number.isFinite(cached) && cached > 0) {
    return cached;
  }
  const persisted = await getPersistedMedian(tag);
  if (persisted != null) {
    setCached(cacheKey, persisted, COFL_MEDIAN_CACHE_MS);
    return persisted;
  }

  const urls = [
    `https://sky.coflnet.com/api/item/price/${encodeURIComponent(tag)}/history/month`,
    `https://sky.coflnet.com/api/item/price/${encodeURIComponent(tag)}/history/year`,
  ];

  for (const historyUrl of urls) {
    const history = await fetchJsonWithTimeout<CoflMonthlyHistoryPoint[]>(historyUrl);
    if (!Array.isArray(history) || history.length === 0) continue;

    const sorted = history
      .map((p) => p.avg)
      .filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    if (sorted.length === 0) continue;

    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 1
        ? Math.round(sorted[mid])
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

    setCached(cacheKey, median, COFL_MEDIAN_CACHE_MS);
    await setPersistedMedian(tag, median);
    return median;
  }

  return null;
}

export async function enrichSkinsWithCoflMedian(
  rows: FireSaleSkinRow[]
): Promise<FireSaleSkinPriceRow[]> {
  const out = new Array<FireSaleSkinPriceRow>(rows.length);
  const concurrency = 3;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= rows.length) return;

      const row = rows[i];
      const manualOverride = MANUAL_PRICE_OVERRIDES[row.cosmetic];
      if (manualOverride != null) {
        out[i] = {
          ...row,
          coflTag: null,
          monthlyMedian: null,
          finalPrice: manualOverride,
          priceSource: "manual_override",
        };
        continue;
      }

      const candidates = await resolveCoflCandidateTags(row.cosmetic);
      let coflTag: string | null = candidates[0] ?? null;
      let median: number | null = null;
      for (const tag of candidates) {
        const m = await fetchMonthlyMedianByTag(tag);
        if (m != null) {
          coflTag = tag;
          median = m;
          break;
        }
      }
      out[i] = {
        ...row,
        coflTag,
        monthlyMedian: median,
        finalPrice: median ?? null,
        priceSource: median != null ? "cofl_monthly_median" : "missing",
      };
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

function getSnapshotPath(): string {
  return join(process.cwd(), "data", "fire-sale-skins-local.json");
}

function getOwnershipSnapshotsPath(): string {
  return join(process.cwd(), "data", "fire-sale-user-ownership-snapshots.json");
}

function makeOwnershipKey(row: Pick<FireSaleSkinRow, "cosmetic" | "dateAvailable">): string {
  return `${row.cosmetic}::${row.dateAvailable}`;
}

function normalizeSnapshotUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function loadOwnershipSnapshotStore(): Promise<FireSaleUserOwnershipStore> {
  try {
    const raw = await readFile(getOwnershipSnapshotsPath(), "utf8");
    const parsed = JSON.parse(raw) as FireSaleUserOwnershipStore;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

async function saveOwnershipSnapshotStore(store: FireSaleUserOwnershipStore): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(getOwnershipSnapshotsPath(), JSON.stringify(store, null, 2), "utf8");
}

export async function saveOwnershipSnapshotForUsername(
  username: string,
  rows: FireSaleSkinPriceRow[]
): Promise<{ savedAt: string; ownedCount: number }> {
  const normalized = normalizeSnapshotUsername(username);
  const ownedKeys = rows.filter((row) => row.owned).map((row) => makeOwnershipKey(row));
  const savedAt = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("fire_sale_owner_snapshots").upsert(
      {
        username: normalized,
        saved_at: savedAt,
        owned_keys: ownedKeys,
      },
      { onConflict: "username" }
    );
    if (error) {
      throw new Error(`Failed saving owner snapshot to Supabase: ${error.message}`);
    }
    return { savedAt, ownedCount: ownedKeys.length };
  }

  const store = await loadOwnershipSnapshotStore();
  store[normalized] = { savedAt, ownedKeys };
  await saveOwnershipSnapshotStore(store);
  return { savedAt, ownedCount: ownedKeys.length };
}

export async function listOwnershipSnapshotUsernames(): Promise<FireSaleUserOwnershipSummary[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("fire_sale_owner_snapshots")
      .select("username,saved_at,owned_keys");
    if (error) {
      throw new Error(`Failed listing owner snapshots from Supabase: ${error.message}`);
    }
    return (data ?? [])
      .map((row) => ({
        username: String((row as { username?: unknown }).username ?? ""),
        savedAt: String((row as { saved_at?: unknown }).saved_at ?? ""),
        ownedCount: Array.isArray((row as { owned_keys?: unknown }).owned_keys)
          ? ((row as { owned_keys?: unknown[] }).owned_keys?.length ?? 0)
          : 0,
      }))
      .filter((row) => row.username.length > 0)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  const store = await loadOwnershipSnapshotStore();
  return Object.entries(store)
    .map(([username, snapshot]) => ({
      username,
      savedAt: snapshot.savedAt,
      ownedCount: snapshot.ownedKeys.length,
    }))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function applyOwnershipSnapshotFromUsername(
  username: string,
  rows: FireSaleSkinPriceRow[]
): Promise<{ rows: FireSaleSkinPriceRow[]; savedAt: string; ownedCount: number } | null> {
  const normalized = normalizeSnapshotUsername(username);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("fire_sale_owner_snapshots")
      .select("saved_at,owned_keys")
      .eq("username", normalized)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed loading owner snapshot from Supabase: ${error.message}`);
    }
    if (!data) return null;
    const ownedKeysRaw = (data as { owned_keys?: unknown }).owned_keys;
    const ownedKeys = Array.isArray(ownedKeysRaw)
      ? ownedKeysRaw.filter((x): x is string => typeof x === "string")
      : [];
    const ownedSet = new Set(ownedKeys);
    const updatedRows = rows.map((row) => ({
      ...row,
      owned: ownedSet.has(makeOwnershipKey(row)),
    }));
    return {
      rows: updatedRows,
      savedAt: String((data as { saved_at?: unknown }).saved_at ?? new Date().toISOString()),
      ownedCount: ownedKeys.length,
    };
  }

  const store = await loadOwnershipSnapshotStore();
  const snapshot = store[normalized];
  if (!snapshot) return null;
  const ownedSet = new Set(snapshot.ownedKeys);
  const updatedRows = rows.map((row) => ({
    ...row,
    owned: ownedSet.has(makeOwnershipKey(row)),
  }));
  return { rows: updatedRows, savedAt: snapshot.savedAt, ownedCount: snapshot.ownedKeys.length };
}

export async function loadLocalSkinSnapshot(): Promise<FireSaleSkinSnapshot | null> {
  const snapshotPath = getSnapshotPath();
  try {
    const raw = await readFile(snapshotPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<FireSaleSkinSnapshot>;
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    return {
      generatedAt:
        typeof parsed.generatedAt === "string"
          ? parsed.generatedAt
          : new Date().toISOString(),
      rows: (parsed.rows as FireSaleSkinPriceRow[]).map((row) => ({
        ...row,
        cosmetic: normalizeCosmeticName(row.cosmetic),
      })),
    };
  } catch {
    return null;
  }
}

export async function saveLocalSkinSnapshot(
  snapshot: FireSaleSkinSnapshot
): Promise<void> {
  const snapshotPath = getSnapshotPath();
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function buildAndStoreSkinSnapshot(): Promise<FireSaleSkinSnapshot> {
  const rows = await loadFireSaleSkinsFromPdf();
  const priced = await enrichSkinsWithCoflMedian(rows);
  const snapshot: FireSaleSkinSnapshot = {
    generatedAt: new Date().toISOString(),
    rows: priced,
  };
  await saveLocalSkinSnapshot(snapshot);
  return snapshot;
}

export async function reloadPricesFromStoredSnapshot(): Promise<FireSaleSkinSnapshot> {
  const existing = await loadLocalSkinSnapshot();
  if (!existing || existing.rows.length === 0) {
    const empty: FireSaleSkinSnapshot = {
      generatedAt: new Date().toISOString(),
      rows: [],
    };
    await saveLocalSkinSnapshot(empty);
    return empty;
  }

  const baseRows: FireSaleSkinRow[] = existing.rows.map((row) => ({
    owned: row.owned,
    cosmetic: row.cosmetic,
    year: row.year,
    dateAvailable: row.dateAvailable,
    stock: row.stock,
    sheetPrice: row.sheetPrice,
  }));

  const priced = await enrichSkinsWithCoflMedian(baseRows);
  const existingByKey = new Map(
    existing.rows.map((row) => [`${row.cosmetic}::${row.dateAvailable}`, row] as const)
  );
  const merged = priced.map((row) => {
    if (row.priceSource !== "missing") return row;
    const prev = existingByKey.get(`${row.cosmetic}::${row.dateAvailable}`);
    if (!prev || prev.monthlyMedian == null) return row;
    return {
      ...row,
      coflTag: prev.coflTag,
      monthlyMedian: prev.monthlyMedian,
      finalPrice: prev.monthlyMedian,
      priceSource: "cofl_monthly_median" as const,
    };
  });
  const snapshot: FireSaleSkinSnapshot = {
    generatedAt: new Date().toISOString(),
    rows: merged,
  };
  await saveLocalSkinSnapshot(snapshot);
  return snapshot;
}

export async function reloadOverridesFromStoredSnapshot(): Promise<FireSaleSkinSnapshot> {
  const existing = await loadLocalSkinSnapshot();
  if (!existing || existing.rows.length === 0) {
    const empty: FireSaleSkinSnapshot = {
      generatedAt: new Date().toISOString(),
      rows: [],
    };
    await saveLocalSkinSnapshot(empty);
    return empty;
  }

  const rows = existing.rows.map((row) => {
    const manualOverride = MANUAL_PRICE_OVERRIDES[row.cosmetic];
    if (manualOverride == null) return row;
    return {
      ...row,
      coflTag: null,
      monthlyMedian: null,
      finalPrice: manualOverride,
      priceSource: "manual_override" as const,
    };
  });

  const snapshot: FireSaleSkinSnapshot = {
    generatedAt: new Date().toISOString(),
    rows,
  };
  await saveLocalSkinSnapshot(snapshot);
  return snapshot;
}

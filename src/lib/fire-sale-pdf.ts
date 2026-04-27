import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { getCached, setCached } from "./cache";

const PDF_CACHE_MS = 5 * 60_000;
const COFL_CACHE_MS = 60 * 60_000;
const COFL_TIMEOUT_MS = 15_000;

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
  finalPrice: number;
  priceSource: "cofl_monthly_median" | "sheet";
};

export type FireSaleSkinSnapshot = {
  generatedAt: string;
  rows: FireSaleSkinPriceRow[];
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
    "Pretty Rabbit Skin": ["PET_SKIN_RABBIT"],
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COFL_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
    if (!body.includes("Skin")) {
      continue;
    }
    const parts = body.match(
      /^(.*?)(\d{4})([A-Za-z]+\s+\d{1,2},\s+\d{4})([\d,]+)$/
    );
    if (!parts) continue;

    const cosmetic = parts[1].trim();
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
  const cacheKey = `fire-sale:cofl-candidates:v1:${name.toLowerCase()}`;
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
  setCached(cacheKey, out, COFL_CACHE_MS);
  return out;
}

async function fetchMonthlyMedianByTag(tag: string): Promise<number | null> {
  const cacheKey = `fire-sale:cofl-median30:v5:${tag}`;
  const cached = getCached<number | null>(cacheKey);
  if (cached !== undefined) return cached;

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

    setCached(cacheKey, median, COFL_CACHE_MS);
    return median;
  }

  setCached(cacheKey, null, COFL_CACHE_MS);
  return null;
}

export async function enrichSkinsWithCoflMedian(
  rows: FireSaleSkinRow[]
): Promise<FireSaleSkinPriceRow[]> {
  const out = new Array<FireSaleSkinPriceRow>(rows.length);
  const concurrency = 10;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= rows.length) return;

      const row = rows[i];
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
        finalPrice: median ?? row.sheetPrice,
        priceSource: median != null ? "cofl_monthly_median" : "sheet",
      };
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

function getSnapshotPath(): string {
  return join(process.cwd(), "data", "fire-sale-skins-local.json");
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
      rows: parsed.rows as FireSaleSkinPriceRow[],
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

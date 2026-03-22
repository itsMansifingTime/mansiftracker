export function formatCoins(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Parses coin amounts with optional k / m / b suffixes (thousand / million / billion).
 * Commas and spaces are ignored. Case-insensitive suffix.
 * Returns null if the string is non-empty but not a valid amount.
 */
export function parseCoinShorthand(input: string): number | null {
  const s = input.trim().replace(/,/g, "").replace(/\s+/g, "");
  if (!s) return 0;

  const m = s.match(/^(\d*\.?\d+)\s*([kmb])?$/i);
  if (!m) return null;

  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;

  const suf = (m[2] ?? "").toLowerCase();
  const mult =
    suf === "k" ? 1e3 : suf === "m" ? 1e6 : suf === "b" ? 1e9 : 1;
  const result = n * mult;
  if (!Number.isFinite(result)) return null;
  return Math.round(result);
}

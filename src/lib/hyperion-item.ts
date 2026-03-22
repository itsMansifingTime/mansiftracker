import { gunzipSync } from "node:zlib";

export function itemBytesContainsHyperion(itemBytes: string): boolean {
  try {
    const buf = Buffer.from(itemBytes, "base64");
    const inflated = gunzipSync(buf);
    return inflated.includes("HYPERION");
  } catch {
    return false;
  }
}

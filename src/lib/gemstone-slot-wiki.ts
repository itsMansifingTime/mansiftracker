import fs from "node:fs";
import path from "node:path";

import { WIKI_GEMSTONE_SLOT_PAGE } from "./gemstone-slots";

/** Repo path from project root (for docs / API metadata). */
export const GEMSTONE_SLOT_WIKI_SNAPSHOT_RELATIVE_PATH =
  "src/lib/data/gemstone-slot-wiki.md" as const;

export { WIKI_GEMSTONE_SLOT_PAGE };

/**
 * Full markdown snapshot of the Gemstone Slot wiki page (see `gemstone-slot-wiki.md`).
 * Server-only — do not import from client components.
 */
export function readGemstoneSlotWikiMarkdown(): string {
  const abs = path.join(process.cwd(), GEMSTONE_SLOT_WIKI_SNAPSHOT_RELATIVE_PATH);
  return fs.readFileSync(abs, "utf-8");
}

/** Bundled with calculator API responses so the UI can load the snapshot without a second round-trip shape guess. */
export const GEMSTONE_SLOT_WIKI_API_ROUTE = "/api/gemstone-slot-wiki" as const;

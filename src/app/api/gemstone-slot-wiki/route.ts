import { NextResponse } from "next/server";

import {
  GEMSTONE_SLOT_WIKI_SNAPSHOT_RELATIVE_PATH,
  readGemstoneSlotWikiMarkdown,
  WIKI_GEMSTONE_SLOT_PAGE,
} from "@/lib/gemstone-slot-wiki";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const markdown = readGemstoneSlotWikiMarkdown();
    return NextResponse.json({
      markdown,
      sourceUrl: WIKI_GEMSTONE_SLOT_PAGE,
      snapshotRelativePath: GEMSTONE_SLOT_WIKI_SNAPSHOT_RELATIVE_PATH,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: msg, sourceUrl: WIKI_GEMSTONE_SLOT_PAGE },
      { status: 500 }
    );
  }
}

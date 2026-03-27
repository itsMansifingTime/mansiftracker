import { NextResponse } from "next/server";
import type { BrowseFilterHints } from "@/lib/browse-hints";
import { emptyBrowseHints } from "@/lib/browse-hints";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.rpc("browse_filter_hints");

  if (error) {
    const msg = error.message ?? "";
    const hint =
      /browse_filter_hints|function|does not exist/i.test(msg)
        ? "Run supabase/browse_filter_hints.sql in the Supabase SQL editor."
        : undefined;
    return NextResponse.json(
      { error: msg, ...(hint ? { hint } : {}) },
      { status: 500 }
    );
  }

  const raw = data as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json(emptyBrowseHints());
  }

  const hints: BrowseFilterHints = {
    enchant_keys: asStringArray(raw.enchant_keys),
    extra_attribute_keys: asStringArray(raw.extra_attribute_keys),
    modifiers: asStringArray(raw.modifiers),
    item_rarities: asStringArray(raw.item_rarities),
    item_ids: asStringArray(raw.item_ids),
  };

  return NextResponse.json(hints);
}

import { getSupabaseAdmin } from "./supabase-admin";
import type { IngestPayload } from "./ingest";

export type IngestionRow = {
  id: string;
  source: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function insertIngestionRow(
  payload: IngestPayload
): Promise<{ id: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      "Supabase admin client unavailable. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const { data, error } = await supabase
    .from("ingestions")
    .insert({
      source: payload.source,
      message: payload.message,
      metadata: payload.metadata ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Insert failed: missing id");
  return { id: String(data.id) };
}

export async function listIngestionRows(limit = 100): Promise<IngestionRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("ingestions")
    .select("id,source,message,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as IngestionRow[];
}

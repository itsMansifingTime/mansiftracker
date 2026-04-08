import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function assertSupabaseProjectUrl(url: string): void {
  const u = url.trim();
  if (/api\.supabase\.com/i.test(u)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be your project URL (https://xxxx.supabase.co from Project Settings → API), not api.supabase.com"
    );
  }
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  assertSupabaseProjectUrl(url);
  if (!client) client = createClient(url, key);
  return client;
}

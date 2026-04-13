import { createHmac, timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Public origin for Stop/Resume links on Discord (link buttons cannot be relative).
 * Prefer explicit env on custom domains; on Vercel, `VERCEL_URL` is set automatically.
 */
export function dealAlertsPublicBaseUrl(): string | null {
  const explicit = process.env.BIN_DEAL_ALERTS_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "");
    return `https://${host}`;
  }
  const next = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (next) return next.replace(/\/$/, "");
  return null;
}

/** Secret for signing pause/resume URLs. */
export function dealPauseSecret(): string | null {
  const s =
    process.env.BIN_DEAL_ALERT_PAUSE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.BIN_DEAL_TEST_PING_SECRET?.trim();
  return s || null;
}

function pausePayload(action: "pause" | "resume"): string {
  return `bin-deal-pause:v1:${action}`;
}

export function signDealPauseAction(action: "pause" | "resume"): string | null {
  const secret = dealPauseSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(pausePayload(action)).digest("hex");
}

export function verifyDealPauseSignature(
  action: "pause" | "resume",
  sig: string
): boolean {
  const secret = dealPauseSecret();
  if (!secret || !/^[0-9a-f]{64}$/i.test(sig)) return false;
  const expected = createHmac("sha256", secret)
    .update(pausePayload(action))
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sig.toLowerCase(), "hex")
    );
  } catch {
    return false;
  }
}

/** Discord message components: link buttons (style 5) for pause / resume. */
export function buildDealAlertControlComponents():
  | { type: 1; components: unknown[] }[]
  | undefined {
  const base = dealAlertsPublicBaseUrl();
  const pauseSig = signDealPauseAction("pause");
  const resumeSig = signDealPauseAction("resume");
  if (!base || !pauseSig || !resumeSig) return undefined;
  const enc = encodeURIComponent;
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: "Stop deal pings",
          url: `${base}/api/bin-deal-alerts/pause?action=pause&sig=${enc(pauseSig)}`,
        },
        {
          type: 2,
          style: 5,
          label: "Resume deal pings",
          url: `${base}/api/bin-deal-alerts/pause?action=resume&sig=${enc(resumeSig)}`,
        },
      ],
    },
  ];
}

/**
 * Whether Discord deal alerts are paused (Supabase row, or HTTP when `supabase` is null).
 */
export async function fetchDealAlertsPaused(
  supabase: SupabaseClient | null
): Promise<boolean> {
  if (supabase) {
    const { data, error } = await supabase
      .from("bin_deal_alert_pause")
      .select("paused")
      .eq("id", "default")
      .maybeSingle();
    if (error || !data) return false;
    return Boolean(data.paused);
  }
  const base = dealAlertsPublicBaseUrl();
  const secret =
    process.env.CRON_SECRET?.trim() ??
    process.env.BIN_DEAL_TEST_PING_SECRET?.trim();
  if (!base || !secret) return false;
  const url = `${base}/api/bin-deal-alerts/paused?secret=${encodeURIComponent(secret)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const j = (await res.json()) as { paused?: boolean };
    return Boolean(j.paused);
  } catch {
    return false;
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Public origin for Stop/Resume links on Discord (link buttons cannot be relative).
 * Prefer explicit env on custom domains; on Vercel, production/deployment URLs are set automatically.
 */
export function dealAlertsPublicBaseUrl(): string | null {
  const explicit = process.env.BIN_DEAL_ALERTS_PUBLIC_BASE_URL?.trim();
  if (explicit) return normalizeOrigin(explicit);

  for (const raw of [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    const n = normalizeOrigin(raw ?? "");
    if (n) return n;
  }
  return null;
}

function normalizeOrigin(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const noTrailing = t.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(noTrailing)) return noTrailing;
  const host = noTrailing.replace(/^\/+/, "");
  if (!host) return null;
  return `https://${host}`;
}

/** Last path segment of a Discord webhook URL — usable as an HMAC secret when no CRON_SECRET is set. */
export function extractDiscordWebhookToken(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const m = url.trim().match(/\/webhooks\/\d+\/([^/?#]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/**
 * All secrets that may sign pause links. Verification accepts a match against any of them
 * (main vs wide webhook, or CRON vs webhook-only deploys).
 */
function allPauseSigningSecrets(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string | null | undefined) => {
    const t = s?.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  push(process.env.BIN_DEAL_ALERT_PAUSE_SECRET);
  push(process.env.CRON_SECRET);
  push(process.env.BIN_DEAL_TEST_PING_SECRET);
  push(extractDiscordWebhookToken(process.env.BIN_DEAL_ALERT_WEBHOOK_URL));
  push(extractDiscordWebhookToken(process.env.BIN_DEAL_KUUDRA_WEBHOOK_URL));
  push(extractDiscordWebhookToken(process.env.BIN_DEAL_HYPERION_WEBHOOK_URL));
  push(extractDiscordWebhookToken(process.env.BIN_DEAL_WIDE_WEBHOOK_URL));
  push(extractDiscordWebhookToken(process.env.BIN_DEAL_WIDE_KUUDRA_WEBHOOK_URL));
  push(extractDiscordWebhookToken(process.env.BIN_DEAL_WIDE_HYPERION_WEBHOOK_URL));
  return out;
}

/** Secret for signing pause/resume URLs (first candidate). @deprecated use allPauseSigningSecrets internally */
export function dealPauseSecret(): string | null {
  const all = allPauseSigningSecrets();
  return all[0] ?? null;
}

function pausePayload(action: "pause" | "resume"): string {
  return `bin-deal-pause:v1:${action}`;
}

function hmacHex(secret: string, action: "pause" | "resume"): string {
  return createHmac("sha256", secret).update(pausePayload(action)).digest("hex");
}

export function signDealPauseAction(action: "pause" | "resume"): string | null {
  const secrets = allPauseSigningSecrets();
  if (secrets.length === 0) return null;
  return hmacHex(secrets[0]!, action);
}

export function verifyDealPauseSignature(
  action: "pause" | "resume",
  sig: string
): boolean {
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
  const sigBuf = Buffer.from(sig.toLowerCase(), "hex");
  for (const secret of allPauseSigningSecrets()) {
    const expected = hmacHex(secret, action);
    try {
      if (
        timingSafeEqual(Buffer.from(expected, "hex"), sigBuf)
      ) {
        return true;
      }
    } catch {
      /* length mismatch */
    }
  }
  return false;
}

/** Same shared secrets as pause links — for GET /api/bin-deal-alerts/paused ?secret= */
export function authorizedBinDealPauseReadSecret(provided: string | null): boolean {
  if (!provided) return false;
  for (const secret of allPauseSigningSecrets()) {
    if (secret.length !== provided.length) continue;
    try {
      if (
        timingSafeEqual(Buffer.from(secret, "utf8"), Buffer.from(provided, "utf8"))
      ) {
        return true;
      }
    } catch {
      /* */
    }
  }
  return false;
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
 * Markdown links for embed body — shown when components cannot be built, or as a fallback
 * (some Discord clients / webhook paths omit action rows).
 */
export function buildDealAlertPauseEmbedLinkLine(): string | null {
  const base = dealAlertsPublicBaseUrl();
  const pauseSig = signDealPauseAction("pause");
  const resumeSig = signDealPauseAction("resume");
  if (!base || !pauseSig || !resumeSig) return null;
  const enc = encodeURIComponent;
  const pauseUrl = `${base}/api/bin-deal-alerts/pause?action=pause&sig=${enc(pauseSig)}`;
  const resumeUrl = `${base}/api/bin-deal-alerts/pause?action=resume&sig=${enc(resumeSig)}`;
  return `[Stop deal pings](${pauseUrl}) · [Resume deal pings](${resumeUrl})`;
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
  const secrets = allPauseSigningSecrets();
  const secret =
    process.env.CRON_SECRET?.trim() ??
    process.env.BIN_DEAL_TEST_PING_SECRET?.trim() ??
    secrets[0];
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

import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_MAX_WEBHOOK_PINGS = 10;
let localWebhookReserveCount = 0;

/** Max Discord webhook sends for deal + test pings combined; `0` = unlimited. */
export function parseDealAlertMaxPings(): number {
  const raw = process.env.BIN_DEAL_ALERT_MAX_PINGS?.trim();
  if (raw === undefined || raw === "") return DEFAULT_MAX_WEBHOOK_PINGS;
  if (raw === "0") return 0;
  const n = Number.parseInt(raw.replace(/_/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_WEBHOOK_PINGS;
}

export type DealAlertWebhookReservation = {
  release: () => Promise<void>;
};

/**
 * Reserve one Discord webhook send. Returns null when cap is exhausted.
 * On Supabase deployments this is atomic across instances.
 */
export async function reserveDealAlertWebhookPing(
  supabase: SupabaseClient | null
): Promise<DealAlertWebhookReservation | null> {
  const max = parseDealAlertMaxPings();
  if (max === 0) return { release: async () => {} };

  if (!supabase) {
    if (localWebhookReserveCount >= max) return null;
    localWebhookReserveCount++;
    return {
      release: async () => {
        localWebhookReserveCount = Math.max(0, localWebhookReserveCount - 1);
      },
    };
  }

  const { data, error } = await supabase.rpc("try_reserve_deal_webhook_ping", {
    p_max: max,
  });

  if (error) {
    if (localWebhookReserveCount >= max) return null;
    localWebhookReserveCount++;
    return {
      release: async () => {
        localWebhookReserveCount = Math.max(0, localWebhookReserveCount - 1);
      },
    };
  }

  if (data !== true) return null;

  return {
    release: async () => {
      await supabase.rpc("release_deal_webhook_ping");
    },
  };
}

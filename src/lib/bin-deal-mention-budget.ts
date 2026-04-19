import type { SupabaseClient } from "@supabase/supabase-js";

/** Default cap for `<@user>` on deal + test Discord webhooks when `BIN_DEAL_ALERT_MENTION_USER_ID` is set. */
const DEFAULT_MAX_MENTION_PINGS = 10;

let localMentionReserveCount = 0;

function useSupabaseDealState(): boolean {
  return process.env.BIN_DEAL_USE_SUPABASE_STATE?.trim() === "true";
}

/** Max @mention pings; `0` = unlimited. Unset defaults to {@link DEFAULT_MAX_MENTION_PINGS}. */
export function parseDealAlertMentionMaxPings(): number {
  const raw = process.env.BIN_DEAL_ALERT_MENTION_MAX_PINGS?.trim();
  if (raw === undefined || raw === "") return DEFAULT_MAX_MENTION_PINGS;
  if (raw === "0") return 0;
  const n = Number.parseInt(raw.replace(/_/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_MENTION_PINGS;
}

/** Numeric Discord user id for @mentions (when set). */
export function rawDealAlertMentionUserId(): string | null {
  const mentionRaw = process.env.BIN_DEAL_ALERT_MENTION_USER_ID?.trim();
  if (mentionRaw && /^\d{17,19}$/.test(mentionRaw)) return mentionRaw;
  return null;
}

export function dealAlertMentionUserId(): string | null {
  if (process.env.BIN_DEAL_ALERT_MENTIONS_ENABLED?.trim() !== "true") {
    return null;
  }
  return rawDealAlertMentionUserId();
}

export type DealAlertMentionReservation = {
  content: string;
  /** Call when the Discord POST failed so the cap is not consumed. */
  release: () => Promise<void>;
};

export type ReserveDealAlertMentionOpts = {
  /**
   * Necron’s Blade line with BIN at or below the high-BIN threshold: always allow @mention
   * when `BIN_DEAL_ALERT_MENTION_USER_ID` is set, even if `BIN_DEAL_ALERT_MENTIONS_ENABLED` is off.
   */
  forceNecronBladeUnderCap?: boolean;
};

/**
 * Reserves one @mention slot when under the cap (atomic in Supabase when configured).
 * Returns `null` when the user should not be pinged for this message.
 */
export async function reserveDealAlertMention(
  supabase: SupabaseClient | null,
  opts?: ReserveDealAlertMentionOpts
): Promise<DealAlertMentionReservation | null> {
  const userId = opts?.forceNecronBladeUnderCap
    ? rawDealAlertMentionUserId()
    : dealAlertMentionUserId();
  if (!userId) return null;

  const max = parseDealAlertMentionMaxPings();
  if (max === 0) {
    return {
      content: `<@${userId}>`,
      release: async () => {},
    };
  }

  const canUseSupabase = useSupabaseDealState() && Boolean(supabase);
  if (!canUseSupabase) {
    if (localMentionReserveCount >= max) return null;
    localMentionReserveCount++;
    return {
      content: `<@${userId}>`,
      release: async () => {
        localMentionReserveCount = Math.max(0, localMentionReserveCount - 1);
      },
    };
  }
  const supabaseClient = supabase!;

  const { data, error } = await supabaseClient.rpc("try_reserve_deal_mention_ping", {
    p_max: max,
  });

  if (error) {
    return {
      content: `<@${userId}>`,
      release: async () => {},
    };
  }

  if (data !== true) {
    return null;
  }

  return {
    content: `<@${userId}>`,
    release: async () => {
      await supabaseClient.rpc("release_deal_mention_ping");
    },
  };
}

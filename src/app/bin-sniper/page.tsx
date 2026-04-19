"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Nav } from "@/components/Nav";

const INTERVAL_MS = 30_000;

function formatScanDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(2) : s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem < 10 ? rem.toFixed(1) : Math.round(rem)}s`;
}

export default function BinSniperPage() {
  const [enabled, setEnabled] = useState(false);
  /** `null` = omit param → server fetches every Hypixel page (needed for new Hyperion BINs). */
  const [maxPages, setMaxPages] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [lastRunDurationMs, setLastRunDurationMs] = useState<number | null>(
    null
  );
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [skippedOverlap, setSkippedOverlap] = useState(false);

  const runningRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runScan = useCallback(async () => {
    if (runningRef.current) {
      setSkippedOverlap(true);
      return;
    }
    setSkippedOverlap(false);
    runningRef.current = true;
    setRunning(true);
    setLastError(null);
    const t0 = performance.now();
    try {
      const q = new URLSearchParams();
      q.set("skipSupabase", "1");
      if (maxPages != null && maxPages >= 1) {
        q.set("maxPages", String(Math.min(500, Math.floor(maxPages))));
      }
      const url = `/api/track-bin-listings?${q}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as { error?: string };
      setLastResult(json);
      if (!res.ok) {
        setLastError(json.error ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setLastResult(null);
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      runningRef.current = false;
      setRunning(false);
      setLastRunAt(new Date());
      setLastRunDurationMs(Math.round(performance.now() - t0));
    }
  }, [maxPages]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    void runScan();
    intervalRef.current = setInterval(() => {
      void runScan();
    }, INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, runScan]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">BIN SNIPER</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Calls{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              GET /api/track-bin-listings?skipSupabase=1
            </code>{" "}
            every {INTERVAL_MS / 1000}s only while <strong className="text-zinc-400">enabled</strong> below.
            Leave this tab open. Scans{" "}
            <strong className="text-zinc-400">do not write to Supabase</strong> (no{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">bin_listings</code> or deal dedupe). With{" "}
            <strong className="text-zinc-400">Discord deal alerts</strong> env set, each run walks Hypixel pages{" "}
            <strong className="text-zinc-400">0–4</strong> (capped): every BIN is decoded one-by-one, allowlisted
            items (e.g. Necron’s Blade line + Dark Claymore:{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              HYPERION,VALKYRIE,SCYLLA,ASTRAEA,DARK_CLAYMORE
            </code>
            ) get craft cost + Discord when margin clears (no DB). Without deal env, the route still runs a full
            paginated scan in parallel decode mode but skips DB writes. If a run is still in progress, the next tick is
            skipped (no overlap).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <span className="text-zinc-400">Sniper</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="BIN SNIPER polling"
              onClick={() => setEnabled((v) => !v)}
              className={`relative h-8 w-14 rounded-full transition ${
                enabled ? "bg-emerald-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white transition ${
                  enabled ? "translate-x-6" : ""
                }`}
              />
            </button>
            <span className="font-medium text-zinc-200">
              {enabled ? "Enabled" : "Disabled"}
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Hypixel pages</span>
            <select
              value={maxPages === null ? "full" : String(maxPages)}
              onChange={(e) => {
                const v = e.target.value;
                setMaxPages(v === "full" ? null : Math.max(1, Math.min(500, Number.parseInt(v, 10) || 1)));
              }}
              disabled={enabled}
              className="min-w-[11rem] rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm disabled:opacity-50"
              title="Uses skipSupabase (no DB). With Discord deal alerts, server caps streaming at 5 pages. Without deal alerts, All pages = full AH decode, still no Supabase."
            >
              <option value="full">All pages (full AH, no deal)</option>
              <option value="3">3 pages</option>
              <option value="5">5 (deal default / cap)</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>

        <div className="space-y-2 text-sm">
          <div className="text-zinc-500">
            Status:{" "}
            {enabled ? (
              <span className="text-emerald-400">polling every {INTERVAL_MS / 1000}s</span>
            ) : (
              <span className="text-zinc-400">idle — disabled until you enable</span>
            )}
            {running ? (
              <span className="ml-2 text-amber-400">· scan in progress…</span>
            ) : null}
            {skippedOverlap ? (
              <span className="ml-2 text-zinc-500">· skipped (previous run still running)</span>
            ) : null}
          </div>
          {lastRunAt && (
            <div className="text-xs text-zinc-500">
              Last completed: {lastRunAt.toLocaleString()}
              {lastRunDurationMs != null ? (
                <span className="text-zinc-400">
                  {" "}
                  · scan took {formatScanDuration(lastRunDurationMs)}
                </span>
              ) : null}
            </div>
          )}
          {lastError && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-red-200">
              {lastError}
            </div>
          )}
        </div>

        {lastResult !== null && (
          <div>
            <h2 className="mb-2 text-sm font-medium text-zinc-400">Last response</h2>
            <pre className="max-h-[28rem] overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 font-mono text-xs leading-relaxed text-zinc-300">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}

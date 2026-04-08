"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";

function formatScanDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(2) : s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem < 10 ? rem.toFixed(1) : Math.round(rem)}s`;
}

export default function AhSnapshotPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  async function runFullSync() {
    setRunning(true);
    setError(null);
    setResult(null);
    setDurationMs(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/bin-listings/full-sync", {
        method: "POST",
        cache: "no-store",
      });
      const json = (await res.json()) as { error?: string };
      setResult(json);
      setDurationMs(Math.round(performance.now() - t0));
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDurationMs(Math.round(performance.now() - t0));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Full AH snapshot
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Clears <code className="rounded bg-zinc-800 px-1 text-xs">bin_listings</code>, then
            crawls every Hypixel active-auctions page, decodes all BIN listings, and writes a fresh
            snapshot to Supabase. Same data as a full{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">GET /api/track-bin-listings</code> run
            with deal alerts off — but replaces the table instead of only upserting new rows.
            Can take several minutes; keep this tab open until it finishes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={running}
            onClick={() => void runFullSync()}
            className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Scanning…" : "Scan full AH & replace snapshot"}
          </button>
          {durationMs != null && !running ? (
            <span className="text-sm text-zinc-500">
              Request took {formatScanDuration(durationMs)}
            </span>
          ) : null}
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {result !== null && (
          <div>
            <h2 className="mb-2 text-sm font-medium text-zinc-400">Response</h2>
            <pre className="max-h-[28rem] overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 font-mono text-xs leading-relaxed text-zinc-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}

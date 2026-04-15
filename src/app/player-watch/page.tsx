"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { PUBLIC_SITE_URL } from "@/lib/site-url";

const SESSION_KEY_PLAYER = "playerWatchNames";
const SESSION_KEY_SECRET = "playerWatchSecret";

const AUTO_SCAN_INTERVAL_MS = 30_000;

export default function PlayerWatchPage() {
  const [players, setPlayers] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [running, setRunning] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const runningRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadFromSession = useCallback(() => {
    try {
      const p = sessionStorage.getItem(SESSION_KEY_PLAYER);
      const s = sessionStorage.getItem(SESSION_KEY_SECRET);
      if (p) setPlayers(p);
      if (s) setApiSecret(s);
    } catch {
      /* ignore */
    }
  }, []);

  const saveSession = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY_PLAYER, players);
      sessionStorage.setItem(SESSION_KEY_SECRET, apiSecret);
    } catch {
      /* ignore */
    }
  }, [players, apiSecret]);

  useEffect(() => {
    loadFromSession();
  }, [loadFromSession]);

  const runWatch = useCallback(async () => {
    if (runningRef.current) return;

    const secret = apiSecret.trim();
    const raw = players.trim();
    if (!secret) {
      setError(
        "Enter your site password (the same string as CRON_SECRET or PLAYER_AUCTION_WATCH_SECRET on Vercel — not a Hypixel key)."
      );
      setResult(null);
      return;
    }
    if (!raw) {
      setError("Enter at least one Minecraft username (comma-separated for multiple).");
      setResult(null);
      return;
    }

    runningRef.current = true;
    setRunning(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set("players", raw);
      q.set("secret", secret);
      q.set("maxPages", String(Math.min(50, Math.max(1, Math.floor(maxPages) || 10))));
      const res = await fetch(`/api/player-auctions-watch?${q}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      setResult(json);
      if (!res.ok) {
        setError(
          typeof json === "object" && json && "error" in json
            ? String((json as { error: string }).error)
            : `HTTP ${res.status}`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [apiSecret, players, maxPages]);

  useEffect(() => {
    if (!autoRun) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    void runWatch();
    intervalRef.current = setInterval(() => {
      void runWatch();
    }, AUTO_SCAN_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRun, runWatch]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Player auction watch</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Uses Hypixel&apos;s{" "}
            <strong className="text-zinc-400">public</strong> auction list —{" "}
            <strong className="text-zinc-400">no Hypixel API key</strong>. The
            password box is only so random people can&apos;t spam your Discord:
            it must match{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">CRON_SECRET</code>{" "}
            (or{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              PLAYER_AUCTION_WATCH_SECRET
            </code>
            ) in Vercel. New listings post to{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs">
              PLAYER_AUCTION_WATCH_WEBHOOK_URL
            </code>
            .
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            Site:{" "}
            <a
              href={PUBLIC_SITE_URL}
              className="text-sky-400 underline hover:text-sky-300"
            >
              {PUBLIC_SITE_URL}
            </a>
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Minecraft username(s)</span>
            <input
              type="text"
              value={players}
              onChange={(e) => setPlayers(e.target.value)}
              placeholder="e.g. Mansif or Player1, Player2"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              autoComplete="off"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Site password (same as Vercel)</span>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Paste CRON_SECRET from Vercel → Settings → Environment Variables"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              autoComplete="off"
            />
            <span className="text-xs text-zinc-600">
              Not from developer.hypixel.net — that is a different key and is not used here. Never share this password. It is sent on each scan (manual or every 30s when auto is on).
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => setAutoRun(e.target.checked)}
              className="size-4 rounded border-zinc-600 bg-zinc-950 text-sky-600 focus:ring-sky-600"
            />
            <span>
              Run scan every <strong className="text-zinc-200">30 seconds</strong>{" "}
              while this tab is open (starts immediately when turned on)
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Max Hypixel AH pages (1–50)</span>
            <input
              type="number"
              min={1}
              max={50}
              value={maxPages}
              onChange={(e) =>
                setMaxPages(Number.parseInt(e.target.value, 10) || 10)
              }
              className="max-w-[120px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={running}
              onClick={() => void runWatch()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {running ? "Running…" : autoRun ? "Run now (also on timer)" : "Run scan"}
            </button>
            <button
              type="button"
              onClick={loadFromSession}
              className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Load saved (session)
            </button>
            <button
              type="button"
              onClick={saveSession}
              className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Save to session
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {result != null && (
          <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </main>
    </div>
  );
}

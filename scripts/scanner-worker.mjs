/**
 * Long-running poller for deployed Next API routes (e.g. Vercel + Railway worker).
 *
 * Env:
 *   TRACK_URL — base URL, no trailing slash (e.g. https://your-app.vercel.app)
 *   SCAN_JOBS — JSON array: [{ "path": "/api/track-bin-listings?skipSupabase=1", "intervalMs": 30000 }, ...]
 *             Default single job: BIN SNIPER (skipSupabase, no bin_listings writes) every 60s if SCAN_JOBS unset.
 *             Optional hourly test ping (needs BIN_DEAL_TEST_PING_ENABLED=true on Vercel):
 *             { "path": "/api/bin-deal-test-ping", "intervalMs": 3600000 } — use same CRON_SECRET as Vercel.
 *
 *   Optional: CRON_SECRET — sent as Authorization: Bearer <value> if set (add the same check in API routes if you use it).
 *
 * Railway injects PORT; we listen so deploy healthchecks succeed (worker has no public HTTP otherwise).
 */

import http from "node:http";

const portEnv = process.env.PORT;
if (portEnv) {
  const port = Number(portEnv);
  http
    .createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("scanner-worker ok\n");
    })
    .listen(port, "0.0.0.0", () => {
      console.log(`[scanner-worker] health listen http://0.0.0.0:${port}`);
    });
}

console.log(
  `[scanner-worker] node ${process.version} — set TRACK_URL in Railway Variables`
);

if (typeof globalThis.fetch !== "function") {
  console.error(
    "scanner-worker: Node 18+ required (global fetch). Set engines.node >=18 in package.json"
  );
  process.exit(1);
}

const base = (process.env.TRACK_URL ?? "").trim().replace(/\/$/, "");
if (!base) {
  console.error(
    "scanner-worker: missing TRACK_URL. In Railway → Variables add TRACK_URL=https://your-app.vercel.app"
  );
  process.exit(1);
}

/** Same URL as the /bin-sniper page — Hypixel scan without Supabase upserts. */
const defaultJobs = [
  { path: "/api/track-bin-listings?skipSupabase=1", intervalMs: 60_000 },
];

let jobs;
try {
  jobs = process.env.SCAN_JOBS
    ? JSON.parse(process.env.SCAN_JOBS)
    : defaultJobs;
} catch (e) {
  const raw = process.env.SCAN_JOBS;
  console.error(
    "scanner-worker: SCAN_JOBS must be valid JSON (one line, double quotes). Example:",
    `[{"path":"/api/track-bin-listings?skipSupabase=1","intervalMs":30000}]`
  );
  if (raw) console.error("scanner-worker: got:", raw.slice(0, 200));
  console.error(e);
  process.exit(1);
}

if (!Array.isArray(jobs) || jobs.length === 0) {
  console.error("scanner-worker: SCAN_JOBS must be a non-empty array");
  process.exit(1);
}

const secret = (
  process.env.CRON_SECRET ?? process.env.BIN_DEAL_TEST_PING_SECRET
)?.trim();

function headers() {
  const h = { Accept: "application/json" };
  if (secret) h.Authorization = `Bearer ${secret}`;
  return h;
}

async function hit(path) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: headers() });
    const text = await res.text();
    const ms = Date.now() - started;
    const preview = text.length > 500 ? `${text.slice(0, 500)}…` : text;
    if (!res.ok) {
      console.error(`[${new Date().toISOString()}] FAIL ${res.status} ${url} (${ms}ms)\n${preview}`);
      return;
    }
    console.log(`[${new Date().toISOString()}] OK ${url} (${ms}ms)`);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] ERROR ${url}`, e);
  }
}

for (const job of jobs) {
  const path = job.path;
  const intervalMs = Number(job.intervalMs);
  if (!path || !Number.isFinite(intervalMs) || intervalMs < 1000) {
    console.error("scanner-worker: each job needs path and intervalMs >= 1000", job);
    process.exit(1);
  }
  hit(path);
  setInterval(() => hit(path), intervalMs);
}

console.log(
  `scanner-worker: ${jobs.length} job(s) → ${base} (intervals: ${jobs.map((j) => j.intervalMs).join(", ")})`
);

/**
 * Long-running poller for deployed Next API routes (e.g. Vercel + Railway worker).
 *
 * Env:
 *   TRACK_URL — base URL, no trailing slash (e.g. https://your-app.vercel.app)
 *   SCAN_JOBS — JSON array: [{ "path": "/api/track-bin-listings", "intervalMs": 30000 }, ...]
 *             Default single job: /api/track-bin-listings every 60s if SCAN_JOBS unset.
 *
 *   Optional: CRON_SECRET — sent as Authorization: Bearer <value> if set (add the same check in API routes if you use it).
 */

const base = (process.env.TRACK_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.error("scanner-worker: set TRACK_URL (e.g. https://your-app.vercel.app)");
  process.exit(1);
}

const defaultJobs = [
  { path: "/api/track-bin-listings", intervalMs: 60_000 },
];

let jobs;
try {
  jobs = process.env.SCAN_JOBS
    ? JSON.parse(process.env.SCAN_JOBS)
    : defaultJobs;
} catch (e) {
  console.error("scanner-worker: SCAN_JOBS must be valid JSON array", e);
  process.exit(1);
}

if (!Array.isArray(jobs) || jobs.length === 0) {
  console.error("scanner-worker: SCAN_JOBS must be a non-empty array");
  process.exit(1);
}

const secret = process.env.CRON_SECRET;

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

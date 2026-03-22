/**
 * Call /api/track-sales while Next is running locally (or set TRACK_URL).
 * Usage: node scripts/track-local.mjs [username]
 *   npm run track:local
 *   npm run track:local -- someplayer
 */

const base = (process.env.TRACK_URL ?? "http://localhost:3000").replace(/\/$/, "");
const username = process.argv[2] ?? "bowpotato";

const url = `${base}/api/track-sales?username=${encodeURIComponent(username)}`;

const res = await fetch(url);
const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  console.error(text);
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);

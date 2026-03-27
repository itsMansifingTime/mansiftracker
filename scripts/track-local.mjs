/**
 * Call /api/track-sales while Next is running (or set TRACK_URL).
 * Logs every auction in Hypixel's auctions_ended snapshot.
 *
 *   npm run track:local
 */

const base = (process.env.TRACK_URL ?? "http://localhost:3000").replace(/\/$/, "");

const url = `${base}/api/track-sales`;

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

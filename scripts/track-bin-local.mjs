/**
 * Call /api/track-bin-listings while Next is running (or set TRACK_URL).
 *
 *   npm run track:bin
 *   npm run track:bin -- --maxPages=10
 */

const base = (process.env.TRACK_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);

const argv = process.argv.slice(2);
const maxArg = argv.find((a) => a.startsWith("--maxPages="));
const q = maxArg ? `?${maxArg.slice(2)}` : "";

const url = `${base}/api/track-bin-listings${q}`;

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

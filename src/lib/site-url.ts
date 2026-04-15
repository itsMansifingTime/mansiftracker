/**
 * Public production URL for MansifTracker.
 * Override locally with `NEXT_PUBLIC_APP_URL` (e.g. http://localhost:3000).
 */
export const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://mansiftracker.vercel.app";

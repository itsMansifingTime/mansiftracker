import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-4 py-16">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Hypixel SkyBlock — Hyperion tools
          </h1>
          <p className="mt-3 max-w-xl text-zinc-400">
            Live craft calculator (Bazaar + CoflNet) and a sold-auction log
            backed by Supabase. Run locally with{" "}
            <code className="rounded bg-zinc-800 px-1 text-sm">npm run dev</code>
            . Tracking uses Hypixel’s short{" "}
            <code className="rounded bg-zinc-800 px-1 text-sm">auctions_ended</code>{" "}
            window — see Tracker for{" "}
            <code className="rounded bg-zinc-800 px-1 text-sm">
              npm run track:local
            </code>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/calculator"
            className="rounded-xl border border-sky-700/50 bg-sky-950/40 px-6 py-3 text-sm font-medium text-sky-200 transition hover:border-sky-600 hover:bg-sky-950/70"
          >
            Hyperion calculator
          </Link>
          <Link
            href="/tracker"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Sold tracker
          </Link>
        </div>
      </main>
    </div>
  );
}

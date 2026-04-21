import { Nav } from "@/components/Nav";
import { listIngestionRows } from "@/lib/ingest-store";

function truncate(s: string, max = 100): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export default async function IngestionsPage() {
  let rows = [] as Awaited<ReturnType<typeof listIngestionRows>>;
  let loadError: string | null = null;
  try {
    rows = await listIngestionRows(200);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load ingestions";
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ingestions</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Newest-first rows from <code className="rounded bg-zinc-800 px-1 text-xs">ingestions</code>.
          </p>
        </div>

        {loadError && (
          <div className="whitespace-pre-wrap rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">
            {loadError}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Message</th>
                  <th className="px-3 py-2 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                      No ingestions yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-zinc-800/80 bg-zinc-950/20 hover:bg-zinc-800/30"
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-400">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2 font-mono text-xs text-zinc-200">
                        {r.source}
                      </td>
                      <td className="max-w-[360px] truncate px-3 py-2 text-zinc-200" title={r.message}>
                        {truncate(r.message, 140)}
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-zinc-400">
                        {r.metadata ? (
                          <code title={JSON.stringify(r.metadata)}>{truncate(JSON.stringify(r.metadata), 120)}</code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

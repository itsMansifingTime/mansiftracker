export async function uuidFromUsername(
  username: string
): Promise<{ id: string; name: string } | null> {
  const u = username.trim();
  if (!u) return null;
  const res = await fetch(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(u)}`,
    { next: { revalidate: 3600 } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mojang HTTP ${res.status}`);
  const j = (await res.json()) as { id: string; name: string };
  if (!j?.id) return null;
  return j;
}

export function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

import { z } from "zod";

export const INGEST_TOKEN_ENV = "INGEST_TOKEN";

export const ingestPayloadSchema = z.object({
  source: z.string().trim().min(1, "source is required"),
  message: z.string().trim().min(1, "message is required"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;

export type IngestInsertResult = { id: string };

export type IngestServiceDeps = {
  insertIngestion: (payload: IngestPayload) => Promise<IngestInsertResult>;
  token?: string | null;
};

export type IngestServiceResult =
  | { status: 201; body: { id: string } }
  | { status: 400; body: { error: string } }
  | { status: 401; body: { error: string } }
  | { status: 500; body: { error: string } };

function bearerTokenFromAuthHeader(auth: string | null): string | null {
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export function isAuthorizedIngestRequest(
  authHeader: string | null,
  envToken = process.env[INGEST_TOKEN_ENV]
): boolean {
  const expected = envToken?.trim();
  if (!expected) return false;
  const got = bearerTokenFromAuthHeader(authHeader);
  return got === expected;
}

export async function processIngestPayload(
  rawBody: unknown,
  authHeader: string | null,
  deps: IngestServiceDeps
): Promise<IngestServiceResult> {
  const expectedToken = deps.token ?? process.env[INGEST_TOKEN_ENV];
  if (!isAuthorizedIngestRequest(authHeader, expectedToken)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const parsed = ingestPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
    };
  }

  try {
    const out = await deps.insertIngestion(parsed.data);
    return { status: 201, body: { id: out.id } };
  } catch (e) {
    return {
      status: 500,
      body: { error: e instanceof Error ? e.message : "Failed to save ingest" },
    };
  }
}

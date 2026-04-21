import { NextResponse } from "next/server";

import { processIngestPayload } from "@/lib/ingest";
import { insertIngestionRow } from "@/lib/ingest-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await processIngestPayload(
    body,
    req.headers.get("authorization"),
    {
      insertIngestion: insertIngestionRow,
    }
  );

  return NextResponse.json(result.body, { status: result.status });
}

import { describe, expect, it, vi } from "vitest";

import { processIngestPayload } from "./ingest";

describe("processIngestPayload", () => {
  it("returns 201 and id for valid payload + auth", async () => {
    const insertIngestion = vi.fn(async () => ({ id: "abc-123" }));
    const out = await processIngestPayload(
      { source: "friend-client", message: "hello", metadata: { tag: "x" } },
      "Bearer token123",
      { token: "token123", insertIngestion }
    );

    expect(out.status).toBe(201);
    expect(out.body).toEqual({ id: "abc-123" });
    expect(insertIngestion).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid body", async () => {
    const insertIngestion = vi.fn(async () => ({ id: "abc-123" }));
    const out = await processIngestPayload(
      { source: "", message: "" },
      "Bearer token123",
      { token: "token123", insertIngestion }
    );

    expect(out.status).toBe(400);
    expect(out.body.error.length).toBeGreaterThan(0);
    expect(insertIngestion).not.toHaveBeenCalled();
  });

  it("returns 401 for missing/invalid auth", async () => {
    const insertIngestion = vi.fn(async () => ({ id: "abc-123" }));
    const out = await processIngestPayload(
      { source: "friend-client", message: "hello" },
      null,
      { token: "token123", insertIngestion }
    );

    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: "Unauthorized" });
    expect(insertIngestion).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb } from "@/test/setup";
import { apiTokens } from "@/lib/db/schema";

let testDb = createTestDb();

vi.mock("@/lib/api-helpers", () => ({
  requireAuth: () => null,
  validateBody: vi.fn().mockImplementation(async (req: NextRequest, schema: any) => {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const { NextResponse } = await import("next/server");
      return [null, NextResponse.json({ error: result.error.flatten() }, { status: 400 })];
    }
    return [result.data, null];
  }),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
  dbReady: Promise.resolve(),
}));

const { POST } = await import("@/app/api/tokens/route");

describe("POST /api/tokens", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("normalizes and deduplicates requested scopes before storage", async () => {
    const req = new NextRequest("http://localhost:3000/api/tokens", {
      method: "POST",
      body: JSON.stringify({
        name: "Scoped token",
        scope: [" docs:read ", "docs:write", "docs:read", "mcp:access"],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const rows = await testDb.db.select().from(apiTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.scope).toBe("docs:read docs:write mcp:access");
  });

  it("rejects scopes outside the allowlist", async () => {
    const req = new NextRequest("http://localhost:3000/api/tokens", {
      method: "POST",
      body: JSON.stringify({
        name: "Bad scope token",
        scope: ["docs:read", "admin:all"],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const payload = await res.json();
    expect(payload.error).toMatch(/Invalid token scope/);

    const rows = await testDb.db.select().from(apiTokens);
    expect(rows).toHaveLength(0);
  });
});

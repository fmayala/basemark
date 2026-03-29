import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb } from "@/test/setup";
import { documents } from "@/lib/db/schema";
import { nanoid } from "nanoid";

let testDb = createTestDb();
const requireAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-helpers", () => ({
  requireAuth: requireAuthMock,
  validateBody: vi.fn().mockImplementation(async (req: NextRequest, schema: any) => {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const { NextResponse } = await import("next/server");
      return [
        null,
        NextResponse.json(
          { error: result.error.issues.map((i: any) => i.message).join(", ") },
          { status: 400 },
        ),
      ];
    }
    return [result.data, null];
  }),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
  get sqlite() {
    return testDb.sqlite;
  },
  dbReady: Promise.resolve(),
}));

vi.mock("@/lib/db/fts", () => ({
  syncDocumentFTS: vi.fn(),
  deleteDocumentFTS: vi.fn(),
  initFTS: vi.fn(),
}));

const { POST } = await import("@/app/api/share/route");

// Helper: insert a document directly using drizzle
async function createDoc(id: string) {
  const now = Math.floor(Date.now() / 1000);
  await testDb.db.insert(documents).values({
    id,
    title: "Test Doc",
    content: "",
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  });
}

describe("POST /api/share", () => {
  beforeEach(() => {
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("rejects share without documentId (400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/share", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent document", async () => {
    const req = new NextRequest("http://localhost:3000/api/share", {
      method: "POST",
      body: JSON.stringify({ documentId: "no-such-doc" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("creates share link for existing document", async () => {
    const docId = nanoid();
    await createDoc(docId);

    const req = new NextRequest("http://localhost:3000/api/share", {
      method: "POST",
      body: JSON.stringify({ documentId: docId }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.token).toBeDefined();
    expect(data.url).toMatch(/^\/share\//);
  });

  it("rejects an expiresAt timestamp in the past", async () => {
    const docId = nanoid();
    await createDoc(docId);

    const past = new Date(Date.now() - 60_000).toISOString();
    const req = new NextRequest("http://localhost:3000/api/share", {
      method: "POST",
      body: JSON.stringify({ documentId: docId, expiresAt: past }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/future/i);
  });

  it("calls requireAuth with documents:write", async () => {
    const req = new NextRequest("http://localhost:3000/api/share", {
      method: "POST",
      body: JSON.stringify({ documentId: "doc-1" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(req);

    expect(requireAuthMock).toHaveBeenCalledWith(req, { requiredScopes: ["documents:write"] });
  });
});

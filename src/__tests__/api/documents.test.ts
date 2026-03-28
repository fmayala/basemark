import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb } from "@/test/setup";

// Create a test DB that persists across the module
let testDb = createTestDb();

// Mock auth to always pass
vi.mock("@/lib/api-helpers", () => ({
  requireAuth: () => null,
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

// Mock db with test database
vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
  get sqlite() {
    return testDb.sqlite;
  },
  dbReady: Promise.resolve(),
}));

// Mock FTS operations since they operate on the real sqlite directly in the route
vi.mock("@/lib/db/fts", () => ({
  syncDocumentFTS: vi.fn(),
  deleteDocumentFTS: vi.fn(),
  initFTS: vi.fn(),
}));

const { GET, POST } = await import("@/app/api/documents/route");

describe("GET /api/documents", () => {
  beforeEach(() => {
    // Reset DB between tests
    testDb = createTestDb();
  });

  it("returns empty array when no documents exist", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });
});

describe("POST /api/documents", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("creates a document with default title 'Untitled'", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.title).toBe("Untitled");
    expect(data.content).toBe("");
    expect(data.id).toBeDefined();
  });

  it("creates a document with a custom title", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "My Document", content: "Hello world" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.title).toBe("My Document");
    expect(data.content).toBe("Hello world");
  });

  it("persists document so GET returns it", async () => {
    // Create a document
    const postReq = new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "Persisted Doc" }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(postReq);

    // GET should return it
    const getReq = new NextRequest("http://localhost:3000/api/documents");
    const res = await GET(getReq);
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Persisted Doc");
  });

  it("rejects oversized document content", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Big Doc",
        content: "x".repeat(500_001),
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});

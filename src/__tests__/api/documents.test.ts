import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb } from "@/test/setup";
import { syncDocumentFTS } from "@/lib/db/fts";

const requireAuthMock = vi.hoisted(() => vi.fn());

// Create a test DB that persists across the module
let testDb = createTestDb();

// Mock auth to always pass
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
const {
  GET: getById,
  PUT: putById,
  DELETE: deleteById,
} = await import("@/app/api/documents/[id]/route");

describe("GET /api/documents", () => {
  beforeEach(() => {
    // Reset DB between tests
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
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
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
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

  it("logs degraded status when index sync fails", async () => {
    vi.mocked(syncDocumentFTS).mockRejectedValueOnce(new Error("fts unavailable"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const req = new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "Warn Doc", content: "Body" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(warnSpy).toHaveBeenCalledWith(
      "search_index_degraded",
      expect.objectContaining({
        operation: "sync_document",
        documentId: data.id,
        reason: "sync_failed",
      }),
    );

    warnSpy.mockRestore();
  });
});

describe("documents route auth scope wiring", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("calls requireAuth with documents:read for list and by-id reads", async () => {
    const listReq = new NextRequest("http://localhost:3000/api/documents");
    await GET(listReq);

    const byIdReq = new NextRequest("http://localhost:3000/api/documents/doc-1");
    await getById(byIdReq, { params: Promise.resolve({ id: "doc-1" }) });

    expect(requireAuthMock).toHaveBeenCalledWith(listReq, { requiredScopes: ["documents:read"] });
    expect(requireAuthMock).toHaveBeenCalledWith(byIdReq, { requiredScopes: ["documents:read"] });
  });

  it("calls requireAuth with documents:write for mutating document routes", async () => {
    const postReq = new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "New Doc" }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(postReq);

    const putReq = new NextRequest("http://localhost:3000/api/documents/doc-1", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated" }),
      headers: { "Content-Type": "application/json" },
    });
    await putById(putReq, { params: Promise.resolve({ id: "doc-1" }) });

    const deleteReq = new NextRequest("http://localhost:3000/api/documents/doc-1", {
      method: "DELETE",
    });
    await deleteById(deleteReq, { params: Promise.resolve({ id: "doc-1" }) });

    expect(requireAuthMock).toHaveBeenCalledWith(postReq, { requiredScopes: ["documents:write"] });
    expect(requireAuthMock).toHaveBeenCalledWith(putReq, { requiredScopes: ["documents:write"] });
    expect(requireAuthMock).toHaveBeenCalledWith(deleteReq, { requiredScopes: ["documents:write"] });
  });
});

describe("PUT /api/documents/[id] concurrency", () => {
  beforeEach(() => {
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("returns 409 with current document when baseUpdatedAt is stale", async () => {
    const createReq = new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "Before", content: "v1" }),
      headers: { "Content-Type": "application/json" },
    });
    const createRes = await POST(createReq);
    const created = await createRes.json();

    const firstUpdateReq = new NextRequest(`http://localhost:3000/api/documents/${created.id}`, {
      method: "PUT",
      body: JSON.stringify({ title: "v2", baseUpdatedAt: created.updatedAt }),
      headers: { "Content-Type": "application/json" },
    });
    const firstUpdateRes = await putById(firstUpdateReq, {
      params: Promise.resolve({ id: created.id }),
    });
    const firstUpdated = await firstUpdateRes.json();
    expect(firstUpdateRes.status).toBe(200);

    const staleUpdateReq = new NextRequest(`http://localhost:3000/api/documents/${created.id}`, {
      method: "PUT",
      body: JSON.stringify({ content: "stale", baseUpdatedAt: created.updatedAt - 1 }),
      headers: { "Content-Type": "application/json" },
    });
    const staleUpdateRes = await putById(staleUpdateReq, {
      params: Promise.resolve({ id: created.id }),
    });
    const stalePayload = await staleUpdateRes.json();

    expect(staleUpdateRes.status).toBe(409);
    expect(stalePayload.error).toBe("Conflict");
    expect(stalePayload.document?.id).toBe(created.id);
    expect(stalePayload.document?.updatedAt).toBe(firstUpdated.updatedAt);
  });
});

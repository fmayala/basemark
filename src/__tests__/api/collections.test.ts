import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb } from "@/test/setup";

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

// Collections route doesn't use FTS, but mock it so setup.ts import doesn't fail
vi.mock("@/lib/db/fts", () => ({
  syncDocumentFTS: vi.fn(),
  deleteDocumentFTS: vi.fn(),
  initFTS: vi.fn(),
}));

const { GET, POST } = await import("@/app/api/collections/route");
const {
  GET: getById,
  PUT: putById,
  DELETE: deleteById,
} = await import("@/app/api/collections/[id]/route");

describe("GET /api/collections", () => {
  beforeEach(() => {
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("returns empty array when no collections exist", async () => {
    const req = new NextRequest("http://localhost:3000/api/collections");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });
});

describe("POST /api/collections", () => {
  beforeEach(() => {
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("creates a collection", async () => {
    const req = new NextRequest("http://localhost:3000/api/collections", {
      method: "POST",
      body: JSON.stringify({ name: "Engineering" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("Engineering");
    expect(data.id).toBeDefined();
  });

  it("rejects collection without name (400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/collections", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("persists collection so GET returns it", async () => {
    const postReq = new NextRequest("http://localhost:3000/api/collections", {
      method: "POST",
      body: JSON.stringify({ name: "Design" }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(postReq);

    const getReq = new NextRequest("http://localhost:3000/api/collections");
    const res = await GET(getReq);
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Design");
  });
});

describe("collections route auth scope wiring", () => {
  beforeEach(() => {
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("calls requireAuth with documents:read for collection reads", async () => {
    const listReq = new NextRequest("http://localhost:3000/api/collections");
    await GET(listReq);

    const byIdReq = new NextRequest("http://localhost:3000/api/collections/col-1");
    await getById(byIdReq, { params: Promise.resolve({ id: "col-1" }) });

    expect(requireAuthMock).toHaveBeenCalledWith(listReq, { requiredScopes: ["documents:read"] });
    expect(requireAuthMock).toHaveBeenCalledWith(byIdReq, { requiredScopes: ["documents:read"] });
  });

  it("calls requireAuth with documents:write for collection mutations", async () => {
    const postReq = new NextRequest("http://localhost:3000/api/collections", {
      method: "POST",
      body: JSON.stringify({ name: "Team" }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(postReq);

    const putReq = new NextRequest("http://localhost:3000/api/collections/col-1", {
      method: "PUT",
      body: JSON.stringify({ name: "Team Updated" }),
      headers: { "Content-Type": "application/json" },
    });
    await putById(putReq, { params: Promise.resolve({ id: "col-1" }) });

    const deleteReq = new NextRequest("http://localhost:3000/api/collections/col-1", {
      method: "DELETE",
    });
    await deleteById(deleteReq, { params: Promise.resolve({ id: "col-1" }) });

    expect(requireAuthMock).toHaveBeenCalledWith(postReq, { requiredScopes: ["documents:write"] });
    expect(requireAuthMock).toHaveBeenCalledWith(putReq, { requiredScopes: ["documents:write"] });
    expect(requireAuthMock).toHaveBeenCalledWith(deleteReq, { requiredScopes: ["documents:write"] });
  });
});

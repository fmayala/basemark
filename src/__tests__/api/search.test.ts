import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb } from "@/test/setup";

let testDb = createTestDb();
const requireAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-helpers", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
  get sqlite() {
    return testDb.sqlite;
  },
  runStatement: async (sql: string, args: any[] = []) => {
    testDb.sqlite.prepare(sql).run(...args);
  },
  queryStatement: async (sql: string, args: any[] = []) => {
    return testDb.sqlite.prepare(sql).all(...args) as any[];
  },
  dbReady: Promise.resolve(),
}));

// The search route uses sqlite directly with raw SQL, so FTS tables
// are created by createTestDb() via initFTS. We don't mock FTS here
// because search needs the real FTS virtual table.
// But we still need to mock the module since db/index.ts imports it.
vi.mock("@/lib/db/fts", async () => {
  const actual = await vi.importActual("@/lib/db/fts");
  return actual;
});

const { GET } = await import("@/app/api/search/route");

describe("GET /api/search", () => {
  beforeEach(() => {
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("returns empty array when query is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/search");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("returns empty array for short query (< 2 chars)", async () => {
    const req = new NextRequest("http://localhost:3000/api/search?q=a");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("returns empty array when no documents match", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/search?q=nonexistent",
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("finds documents indexed in FTS", async () => {
    // Manually insert into FTS table
    testDb.sqlite
      .prepare(
        "INSERT INTO documents_fts (doc_id, title, content_text) VALUES (?, ?, ?)",
      )
      .run("doc-1", "Architecture Notes", "Detailed notes about system design");

    const req = new NextRequest(
      "http://localhost:3000/api/search?q=architecture",
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("doc-1");
    expect(data[0].title).toBe("Architecture Notes");
  });

  it("calls requireAuth with documents:read", async () => {
    const req = new NextRequest("http://localhost:3000/api/search?q=notes");

    await GET(req);

    expect(requireAuthMock).toHaveBeenCalledWith(req, { requiredScopes: ["documents:read"] });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { createTestDb } from "@/test/setup";
import { hashToken } from "@/domain/repos/tokens-repo";

let testDb = createTestDb();

vi.mock("@/auth", () => ({
  auth: vi.fn(),
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

const { GET } = await import("@/app/api/sync/changes/route");

function insertToken(scope = "documents:read") {
  testDb.sqlite
    .prepare(
      `
        insert into api_tokens (
          id, token_hash, name, scope, created_at
        ) values (?, ?, ?, ?, ?)
      `,
    )
    .run("tok_1", hashToken("bm_valid_token"), "Mobile", scope, 100);
}

describe("GET /api/sync/changes", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("requires a valid bearer token", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/sync/changes"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns changed documents, collections, and deletions from the cursor onward", async () => {
    insertToken();

    testDb.sqlite.exec(`
      insert into collections (id, name, sort_order, created_at, updated_at)
      values ('col-1', 'Engineering', 0, 10, 15);

      insert into documents (
        id, title, content, collection_id, is_public, sort_order, created_at, updated_at
      ) values ('doc-1', 'Alpha', '{}', 'col-1', 0, 0, 11, 20);

      insert into documents (
        id, title, content, collection_id, is_public, sort_order, created_at, updated_at
      ) values ('doc-2', 'Beta', '{}', null, 0, 1, 12, 25);

      insert into tombstones (id, entity_type, entity_id, deleted_at)
      values ('ts-1', 'document', 'doc-deleted', 30);
    `);

    const req = new NextRequest("http://localhost:3000/api/sync/changes?cursor=20", {
      headers: { Authorization: "Bearer bm_valid_token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.documents.map((row: { id: string }) => row.id)).toEqual(["doc-1", "doc-2"]);
    expect(data.collections).toEqual([]);
    expect(data.deletions).toEqual([
      { entityType: "document", entityId: "doc-deleted", deletedAt: 30 },
    ]);
    expect(data.cursor).toBe(30);
    expect(data.hasMore).toBe(false);
  });

  it("honors the limit parameter across the merged change stream", async () => {
    insertToken();

    testDb.sqlite.exec(`
      insert into collections (id, name, sort_order, created_at, updated_at)
      values ('col-1', 'Engineering', 0, 10, 10);

      insert into documents (
        id, title, content, collection_id, is_public, sort_order, created_at, updated_at
      ) values ('doc-1', 'Alpha', '{}', null, 0, 0, 11, 11);

      insert into tombstones (id, entity_type, entity_id, deleted_at)
      values ('ts-1', 'document', 'doc-deleted', 12);
    `);

    const req = new NextRequest("http://localhost:3000/api/sync/changes?limit=2", {
      headers: { Authorization: "Bearer bm_valid_token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.collections).toHaveLength(1);
    expect(data.documents).toHaveLength(1);
    expect(data.deletions).toEqual([]);
    expect(data.cursor).toBe(11);
    expect(data.hasMore).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/setup";
import { documentPermissions, documents } from "@/lib/db/schema";

let testDb = createTestDb();
const requireAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-helpers", () => ({
  requireAuth: requireAuthMock,
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
  get sqlite() {
    return testDb.sqlite;
  },
  dbReady: Promise.resolve(),
}));

const { DELETE } = await import("@/app/api/documents/[id]/permissions/[permId]/route");
const { GET, POST } = await import("@/app/api/documents/[id]/permissions/route");

async function createDoc(id: string) {
  const now = Math.floor(Date.now() / 1000);
  await testDb.db.insert(documents).values({
    id,
    title: `Doc ${id}`,
    content: "",
    sortOrder: 0,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  });
}

describe("DELETE /api/documents/[id]/permissions/[permId]", () => {
  beforeEach(() => {
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("does not delete a permission from another document", async () => {
    await createDoc("doc-a");
    await createDoc("doc-b");

    await testDb.db.insert(documentPermissions).values({
      id: "perm-1",
      documentId: "doc-b",
      email: "viewer@example.com",
      role: "viewer",
      createdAt: Math.floor(Date.now() / 1000),
    });

    const req = new NextRequest(
      "http://localhost:3000/api/documents/doc-a/permissions/perm-1",
      { method: "DELETE" },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "doc-a", permId: "perm-1" }),
    });

    expect(res.status).toBe(404);

    const remaining = await testDb.db
      .select()
      .from(documentPermissions)
      .where(eq(documentPermissions.id, "perm-1"));
    expect(remaining).toHaveLength(1);
  });

  it("deletes the permission when id and document both match", async () => {
    await createDoc("doc-a");

    await testDb.db.insert(documentPermissions).values({
      id: "perm-1",
      documentId: "doc-a",
      email: "viewer@example.com",
      role: "viewer",
      createdAt: Math.floor(Date.now() / 1000),
    });

    const req = new NextRequest(
      "http://localhost:3000/api/documents/doc-a/permissions/perm-1",
      { method: "DELETE" },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "doc-a", permId: "perm-1" }),
    });

    expect(res.status).toBe(200);

    const remaining = await testDb.db
      .select()
      .from(documentPermissions)
      .where(eq(documentPermissions.id, "perm-1"));
    expect(remaining).toHaveLength(0);
  });
});

describe("POST /api/documents/[id]/permissions", () => {
  beforeEach(() => {
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("stores a canonicalized email address", async () => {
    await createDoc("doc-a");

    const req = new NextRequest(
      "http://localhost:3000/api/documents/doc-a/permissions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "  Viewer@Example.com  " }),
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: "doc-a" }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.email).toBe("viewer@example.com");
  });

  it("upserts existing permission instead of creating duplicates", async () => {
    await createDoc("doc-a");

    const req1 = new NextRequest(
      "http://localhost:3000/api/documents/doc-a/permissions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "viewer@example.com", role: "viewer" }),
      },
    );

    const req2 = new NextRequest(
      "http://localhost:3000/api/documents/doc-a/permissions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "Viewer@Example.com", role: "editor" }),
      },
    );

    await POST(req1, { params: Promise.resolve({ id: "doc-a" }) });
    const res2 = await POST(req2, { params: Promise.resolve({ id: "doc-a" }) });

    expect(res2.status).toBe(201);

    const perms = await testDb.db
      .select()
      .from(documentPermissions)
      .where(eq(documentPermissions.documentId, "doc-a"));

    expect(perms).toHaveLength(1);
    expect(perms[0].email).toBe("viewer@example.com");
    expect(perms[0].role).toBe("editor");
  });
});

describe("permissions route auth scope wiring", () => {
  beforeEach(() => {
    testDb = createTestDb();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(null);
  });

  it("calls requireAuth with documents:read for permission listing", async () => {
    await createDoc("doc-a");

    const req = new NextRequest("http://localhost:3000/api/documents/doc-a/permissions");
    await GET(req, { params: Promise.resolve({ id: "doc-a" }) });

    expect(requireAuthMock).toHaveBeenCalledWith(req, { requiredScopes: ["documents:read"] });
  });

  it("calls requireAuth with documents:write for permission mutations", async () => {
    await createDoc("doc-a");

    const postReq = new NextRequest("http://localhost:3000/api/documents/doc-a/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "viewer@example.com" }),
    });
    await POST(postReq, { params: Promise.resolve({ id: "doc-a" }) });

    await testDb.db.insert(documentPermissions).values({
      id: "perm-write",
      documentId: "doc-a",
      email: "editor@example.com",
      role: "viewer",
      createdAt: Math.floor(Date.now() / 1000),
    });

    const deleteReq = new NextRequest(
      "http://localhost:3000/api/documents/doc-a/permissions/perm-write",
      { method: "DELETE" },
    );
    await DELETE(deleteReq, { params: Promise.resolve({ id: "doc-a", permId: "perm-write" }) });

    expect(requireAuthMock).toHaveBeenCalledWith(postReq, { requiredScopes: ["documents:write"] });
    expect(requireAuthMock).toHaveBeenCalledWith(deleteReq, { requiredScopes: ["documents:write"] });
  });
});

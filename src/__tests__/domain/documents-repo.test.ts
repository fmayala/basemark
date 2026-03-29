import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/test/setup";

let testDb = createTestDb();

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
  dbReady: Promise.resolve(),
}));

const {
  createDocumentRecord,
  listDocumentRecords,
  updateDocumentRecord,
  deleteDocumentRecord,
} = await import("@/domain/repos/documents-repo");
const { upsertPermission, listPermissionsForDocument } = await import(
  "@/domain/repos/permissions-repo"
);

describe("documents-repo", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("creates and lists documents sorted by sortOrder then updatedAt", async () => {
    await createDocumentRecord({
      id: "doc-1",
      title: "A",
      content: "",
      sortOrder: 1,
      now: 100,
    });
    await createDocumentRecord({
      id: "doc-2",
      title: "B",
      content: "",
      sortOrder: 0,
      now: 101,
    });

    const rows = await listDocumentRecords({ includeContent: false });
    expect(rows.map((row) => row.id)).toEqual(["doc-2", "doc-1"]);
  });

  it("updates and deletes a document", async () => {
    await createDocumentRecord({
      id: "doc-3",
      title: "Before",
      content: "",
      sortOrder: 0,
      now: 100,
    });
    const updated = await updateDocumentRecord("doc-3", {
      title: "After",
      updatedAt: 200,
    });
    expect(updated?.title).toBe("After");

    const deleted = await deleteDocumentRecord("doc-3");
    expect(deleted?.id).toBe("doc-3");
  });

  it("upserts document permissions on document+email", async () => {
    await createDocumentRecord({
      id: "doc-4",
      title: "Doc",
      content: "",
      sortOrder: 0,
      now: 100,
    });

    await upsertPermission({
      id: "perm-1",
      documentId: "doc-4",
      email: "a@example.com",
      role: "viewer",
      createdAt: 110,
    });

    await upsertPermission({
      id: "perm-2",
      documentId: "doc-4",
      email: "a@example.com",
      role: "editor",
      createdAt: 120,
    });

    const perms = await listPermissionsForDocument("doc-4");
    expect(perms).toHaveLength(1);
    const [permission] = perms;
    expect(permission?.role).toBe("editor");
    expect(permission?.id).toBe("perm-1");
    expect(permission?.createdAt).toBe(110);
  });
});

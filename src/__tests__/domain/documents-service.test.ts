import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDocumentsService } from "@/domain/services/documents-service";

type DocRecord = {
  id: string;
  title: string;
  content: string;
  collectionId: string | null;
  sortOrder: number;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
};

describe("documents-service", () => {
  const now = 1_700_000_000;
  let repo: {
    listDocumentRecords: ReturnType<typeof vi.fn>;
    getDocumentRecordById: ReturnType<typeof vi.fn>;
    createDocumentRecord: ReturnType<typeof vi.fn>;
    updateDocumentRecord: ReturnType<typeof vi.fn>;
    deleteDocumentRecord: ReturnType<typeof vi.fn>;
  };
  let searchIndex: {
    syncDocument: ReturnType<typeof vi.fn>;
    removeDocument: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repo = {
      listDocumentRecords: vi.fn(),
      getDocumentRecordById: vi.fn(),
      createDocumentRecord: vi.fn(),
      updateDocumentRecord: vi.fn(),
      deleteDocumentRecord: vi.fn(),
    };
    searchIndex = {
      syncDocument: vi.fn(),
      removeDocument: vi.fn(),
    };
  });

  it("creates a document with defaults and syncs index", async () => {
    const doc: DocRecord = {
      id: "doc-1",
      title: "Untitled",
      content: "",
      collectionId: null,
      sortOrder: 0,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    };
    repo.createDocumentRecord.mockResolvedValue(doc);

    const service = createDocumentsService({
      repo,
      searchIndex,
      generateId: () => "doc-1",
      now: () => now,
    });

    const created = await service.createDocument({});

    expect(created).toEqual(doc);
    expect(repo.createDocumentRecord).toHaveBeenCalledWith({
      id: "doc-1",
      title: "Untitled",
      content: "",
      collectionId: null,
      sortOrder: 0,
      now,
    });
    expect(searchIndex.syncDocument).toHaveBeenCalledWith("doc-1");
  });

  it("returns current document when update payload is empty", async () => {
    const doc: DocRecord = {
      id: "doc-1",
      title: "Existing",
      content: "",
      collectionId: null,
      sortOrder: 0,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    };
    repo.getDocumentRecordById.mockResolvedValue(doc);

    const service = createDocumentsService({
      repo,
      searchIndex,
      generateId: () => "unused",
      now: () => now,
    });

    const updated = await service.updateDocument("doc-1", {});

    expect(updated).toEqual(doc);
    expect(repo.updateDocumentRecord).not.toHaveBeenCalled();
    expect(searchIndex.syncDocument).not.toHaveBeenCalled();
  });

  it("updates content/title with updatedAt and syncs index", async () => {
    const updatedDoc: DocRecord = {
      id: "doc-1",
      title: "After",
      content: "Body",
      collectionId: null,
      sortOrder: 0,
      isPublic: false,
      createdAt: now - 10,
      updatedAt: now,
    };
    repo.updateDocumentRecord.mockResolvedValue(updatedDoc);

    const service = createDocumentsService({
      repo,
      searchIndex,
      generateId: () => "unused",
      now: () => now,
    });

    const result = await service.updateDocument("doc-1", { title: "After", content: "Body" });

    expect(result).toEqual(updatedDoc);
    expect(repo.updateDocumentRecord).toHaveBeenCalledWith("doc-1", {
      title: "After",
      content: "Body",
      updatedAt: now,
    });
    expect(searchIndex.syncDocument).toHaveBeenCalledWith("doc-1");
  });

  it("deletes source record first then best-effort index removal", async () => {
    repo.deleteDocumentRecord.mockResolvedValue({ id: "doc-1" });
    searchIndex.removeDocument.mockRejectedValue(new Error("fts unavailable"));

    const service = createDocumentsService({
      repo,
      searchIndex,
      generateId: () => "unused",
      now: () => now,
    });

    const result = await service.deleteDocument("doc-1");

    expect(result).toEqual({ success: true });
    expect(repo.deleteDocumentRecord).toHaveBeenCalledWith("doc-1");
    expect(searchIndex.removeDocument).toHaveBeenCalledWith("doc-1");
    expect(repo.deleteDocumentRecord.mock.invocationCallOrder[0]).toBeLessThan(
      searchIndex.removeDocument.mock.invocationCallOrder[0],
    );
  });

  it("returns not_found when source document does not exist", async () => {
    repo.deleteDocumentRecord.mockResolvedValue(null);

    const service = createDocumentsService({
      repo,
      searchIndex,
      generateId: () => "unused",
      now: () => now,
    });

    const result = await service.deleteDocument("missing");

    expect(result).toEqual({ success: false, reason: "not_found" });
    expect(searchIndex.removeDocument).not.toHaveBeenCalled();
  });
});

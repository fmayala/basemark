import { describe, expect, it, vi, beforeEach } from "vitest";
import { deleteDocumentIndex, rebuildDocumentIndex, syncDocumentIndex } from "@/domain/repos/fts-repo";

const ftsMocks = vi.hoisted(() => ({
  syncDocumentFTS: vi.fn<(documentId: string) => Promise<void>>(),
  deleteDocumentFTS: vi.fn<(documentId: string) => Promise<void>>(),
  rebuildFTSFromDocuments: vi.fn<() => Promise<void>>(),
  searchDocuments: vi.fn<(query: string, limit?: number) => Promise<Array<{ id: string }>>>(),
}));

vi.mock("@/lib/db/fts", () => ftsMocks);

vi.mock("@/lib/db", () => ({
  runStatement: vi.fn(),
  queryStatement: vi.fn(),
}));

vi.mock("@/lib/text", () => ({
  extractText: vi.fn(),
}));

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("fts-repo serialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("waits for in-flight sync before starting rebuild", async () => {
    const gate = createDeferred();
    let rebuildStarted = false;

    ftsMocks.syncDocumentFTS.mockImplementation(async () => {
      await gate.promise;
    });
    ftsMocks.rebuildFTSFromDocuments.mockImplementation(async () => {
      rebuildStarted = true;
    });

    const syncPromise = syncDocumentIndex("doc-1");
    const rebuildPromise = rebuildDocumentIndex();

    await Promise.resolve();
    expect(rebuildStarted).toBe(false);

    gate.resolve();
    await syncPromise;
    await rebuildPromise;

    expect(rebuildStarted).toBe(true);
    expect(ftsMocks.syncDocumentFTS.mock.invocationCallOrder[0]).toBeLessThan(
      ftsMocks.rebuildFTSFromDocuments.mock.invocationCallOrder[0],
    );
  });

  it("waits for in-flight rebuild before running delete", async () => {
    const gate = createDeferred();
    let deleteStarted = false;

    ftsMocks.rebuildFTSFromDocuments.mockImplementation(async () => {
      await gate.promise;
    });
    ftsMocks.deleteDocumentFTS.mockImplementation(async () => {
      deleteStarted = true;
    });

    const rebuildPromise = rebuildDocumentIndex();
    const deletePromise = deleteDocumentIndex("doc-1");

    await Promise.resolve();
    expect(deleteStarted).toBe(false);

    gate.resolve();
    await rebuildPromise;
    await deletePromise;

    expect(deleteStarted).toBe(true);
    expect(ftsMocks.rebuildFTSFromDocuments.mock.invocationCallOrder[0]).toBeLessThan(
      ftsMocks.deleteDocumentFTS.mock.invocationCallOrder[0],
    );
  });
});

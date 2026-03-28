import { beforeEach, describe, expect, it, vi } from "vitest";

const runStatementMock = vi.hoisted(() => vi.fn());
const queryStatementMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/index", () => ({
  runStatement: runStatementMock,
  queryStatement: queryStatementMock,
}));

const { syncDocumentFTS, rebuildFTSFromDocuments } = await import("@/lib/db/fts");

describe("fts synchronization", () => {
  beforeEach(() => {
    runStatementMock.mockReset();
    queryStatementMock.mockReset();
  });

  it("serializes sync operations per document id", async () => {
    queryStatementMock
      .mockResolvedValueOnce([{ title: "Title 1", content: "Body 1" }])
      .mockResolvedValueOnce([{ title: "Title 2", content: "Body 2" }]);

    let releaseFirstDelete = () => {};
    const firstDeleteGate = new Promise<void>((resolve) => {
      releaseFirstDelete = () => resolve();
    });

    let firstDeleteBlocked = false;

    runStatementMock.mockImplementation((sql: string) => {
      if (sql.includes("DELETE FROM documents_fts") && !firstDeleteBlocked) {
        firstDeleteBlocked = true;
        return firstDeleteGate;
      }
      return Promise.resolve();
    });

    const op1 = syncDocumentFTS("doc-1");
    await flushMicrotasks();

    const op2 = syncDocumentFTS("doc-1");
    await flushMicrotasks();

    const deleteCallsBeforeRelease = runStatementMock.mock.calls.filter(([sql]) =>
      String(sql).includes("DELETE FROM documents_fts"),
    );
    expect(deleteCallsBeforeRelease).toHaveLength(1);

    releaseFirstDelete();
    await Promise.all([op1, op2]);

    const deleteCalls = runStatementMock.mock.calls.filter(([sql]) =>
      String(sql).includes("DELETE FROM documents_fts"),
    );
    expect(deleteCalls).toHaveLength(2);

    const insertCalls = runStatementMock.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO documents_fts"),
    );
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0][1]).toEqual(["doc-1", "Title 1", "Body 1"]);
    expect(insertCalls[1][1]).toEqual(["doc-1", "Title 2", "Body 2"]);
  });

  it("uses canonical persisted document state for FTS writes", async () => {
    queryStatementMock.mockResolvedValue([
      {
        title: "Latest Persisted",
        content: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Canonical body" }],
            },
          ],
        }),
      },
    ]);

    await syncDocumentFTS("doc-1", "Stale title", "Stale body");

    expect(queryStatementMock).toHaveBeenCalledWith(
      expect.stringContaining("SELECT title, content FROM documents"),
      ["doc-1"],
    );

    const insertCall = runStatementMock.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO documents_fts"),
    );

    expect(insertCall?.[1]).toEqual(["doc-1", "Latest Persisted", "Canonical body"]);
  });

  it("supports full reindex from canonical documents table", async () => {
    queryStatementMock.mockResolvedValueOnce([
      {
        id: "doc-1",
        title: "A",
        content: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Plain" }],
            },
          ],
        }),
      },
    ]);

    await rebuildFTSFromDocuments();

    expect(queryStatementMock).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id, title, content FROM documents"),
    );

    const insertCall = runStatementMock.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO documents_fts"),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]).toEqual(["doc-1", "A", "Plain"]);
  });

  it("serializes rebuild against per-document sync operations", async () => {
    queryStatementMock
      .mockResolvedValueOnce([
        {
          id: "doc-1",
          title: "A",
          content: JSON.stringify({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Rebuild body" }],
              },
            ],
          }),
        },
      ])
      .mockResolvedValueOnce([{ title: "Doc 2", content: "Sync body" }]);

    let releaseRebuildInsert = () => {};
    const rebuildInsertGate = new Promise<void>((resolve) => {
      releaseRebuildInsert = () => resolve();
    });

    let rebuildInsertBlocked = false;
    runStatementMock.mockImplementation((sql: string, params?: unknown[]) => {
      if (
        sql.includes("INSERT INTO documents_fts") &&
        Array.isArray(params) &&
        params[0] === "doc-1" &&
        !rebuildInsertBlocked
      ) {
        rebuildInsertBlocked = true;
        return rebuildInsertGate;
      }
      return Promise.resolve();
    });

    const rebuild = rebuildFTSFromDocuments();
    await flushMicrotasks();

    const sync = syncDocumentFTS("doc-2");
    await flushMicrotasks();

    expect(queryStatementMock).toHaveBeenCalledTimes(1);

    releaseRebuildInsert();
    await Promise.all([rebuild, sync]);

    expect(queryStatementMock).toHaveBeenCalledTimes(2);
  });
});

async function flushMicrotasks(iterations: number = 8): Promise<void> {
  for (let i = 0; i < iterations; i += 1) {
    await Promise.resolve();
  }
}

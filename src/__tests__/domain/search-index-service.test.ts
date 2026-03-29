import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSearchIndexService } from "@/domain/services/search-index-service";

type CreateSearchIndexServiceOptions = NonNullable<Parameters<typeof createSearchIndexService>[0]>;
type SearchIndexRepo = NonNullable<CreateSearchIndexServiceOptions["repo"]>;

describe("search-index-service", () => {
  let repo: {
    syncDocumentIndex: ReturnType<typeof vi.fn<SearchIndexRepo["syncDocumentIndex"]>>;
    deleteDocumentIndex: ReturnType<typeof vi.fn<SearchIndexRepo["deleteDocumentIndex"]>>;
    rebuildDocumentIndex: ReturnType<typeof vi.fn<SearchIndexRepo["rebuildDocumentIndex"]>>;
  };

  beforeEach(() => {
    repo = {
      syncDocumentIndex: vi.fn(),
      deleteDocumentIndex: vi.fn(),
      rebuildDocumentIndex: vi.fn(),
    };
  });

  it("returns ok when sync succeeds", async () => {
    const service = createSearchIndexService({ repo });

    await expect(service.syncDocument("doc-1")).resolves.toEqual({ status: "ok" });
    expect(repo.syncDocumentIndex).toHaveBeenCalledWith("doc-1");
  });

  it("returns degraded when sync fails", async () => {
    repo.syncDocumentIndex.mockRejectedValue(new Error("fts unavailable"));
    const service = createSearchIndexService({ repo });

    await expect(service.syncDocument("doc-1")).resolves.toEqual({
      status: "degraded",
      reason: "sync_failed",
    });
  });

  it("returns ok when delete succeeds", async () => {
    const service = createSearchIndexService({ repo });

    await expect(service.deleteDocument("doc-1")).resolves.toEqual({ status: "ok" });
    expect(repo.deleteDocumentIndex).toHaveBeenCalledWith("doc-1");
  });

  it("returns degraded when delete fails", async () => {
    repo.deleteDocumentIndex.mockRejectedValue(new Error("fts unavailable"));
    const service = createSearchIndexService({ repo });

    await expect(service.deleteDocument("doc-1")).resolves.toEqual({
      status: "degraded",
      reason: "delete_failed",
    });
  });

  it("returns ok when rebuild succeeds", async () => {
    const service = createSearchIndexService({ repo });

    await expect(service.rebuild()).resolves.toEqual({ status: "ok" });
    expect(repo.rebuildDocumentIndex).toHaveBeenCalledTimes(1);
  });

  it("returns degraded when rebuild fails", async () => {
    repo.rebuildDocumentIndex.mockRejectedValue(new Error("fts unavailable"));
    const service = createSearchIndexService({ repo });

    await expect(service.rebuild()).resolves.toEqual({
      status: "degraded",
      reason: "rebuild_failed",
    });
  });
});

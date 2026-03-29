import {
  syncDocumentIndex,
  deleteDocumentIndex,
  rebuildDocumentIndex,
} from "@/domain/repos/fts-repo";

type SearchIndexRepo = {
  syncDocumentIndex: (documentId: string) => Promise<void>;
  deleteDocumentIndex: (documentId: string) => Promise<void>;
  rebuildDocumentIndex: () => Promise<void>;
};

type SearchIndexStatus = { status: "ok" } | { status: "degraded"; reason: string };

type CreateSearchIndexServiceOptions = {
  repo?: SearchIndexRepo;
};

export function createSearchIndexService(options: CreateSearchIndexServiceOptions = {}) {
  const repo = options.repo ?? {
    syncDocumentIndex,
    deleteDocumentIndex,
    rebuildDocumentIndex,
  };

  return {
    async syncDocument(documentId: string): Promise<SearchIndexStatus> {
      try {
        await repo.syncDocumentIndex(documentId);
        return { status: "ok" };
      } catch {
        return { status: "degraded", reason: "sync_failed" };
      }
    },

    async deleteDocument(documentId: string): Promise<SearchIndexStatus> {
      try {
        await repo.deleteDocumentIndex(documentId);
        return { status: "ok" };
      } catch {
        return { status: "degraded", reason: "delete_failed" };
      }
    },

    async rebuild(): Promise<SearchIndexStatus> {
      try {
        await repo.rebuildDocumentIndex();
        return { status: "ok" };
      } catch {
        return { status: "degraded", reason: "rebuild_failed" };
      }
    },
  };
}

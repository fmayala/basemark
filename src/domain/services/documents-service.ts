import { nanoid } from "nanoid";
import {
  createDocumentRecord,
  deleteDocumentRecord,
  getDocumentRecordById,
  listDocumentRecords,
  updateDocumentRecord,
  type UpdateDocumentRecordInput,
} from "@/domain/repos/documents-repo";
import { writeTombstone } from "@/domain/repos/tombstones-repo";

type DocumentsRepo = {
  listDocumentRecords: typeof listDocumentRecords;
  getDocumentRecordById: typeof getDocumentRecordById;
  createDocumentRecord: typeof createDocumentRecord;
  updateDocumentRecord: typeof updateDocumentRecord;
  deleteDocumentRecord: typeof deleteDocumentRecord;
};

type SearchIndexAdapter = {
  syncDocument: (documentId: string) => Promise<void>;
  removeDocument: (documentId: string) => Promise<void>;
};

type TombstonesAdapter = {
  writeTombstone: typeof writeTombstone;
};

type CreateDocumentsServiceOptions = {
  repo?: DocumentsRepo;
  searchIndex: SearchIndexAdapter;
  tombstones?: TombstonesAdapter;
  generateId?: () => string;
  now?: () => number;
};

type CreateDocumentInput = {
  id?: string;
  title?: string;
  content?: string;
  collectionId?: string | null;
  sortOrder?: number;
  isPublic?: boolean;
};

type UpdateDocumentInput = {
  title?: string;
  content?: string;
  collectionId?: string | null;
  sortOrder?: number;
  isPublic?: boolean;
  baseUpdatedAt?: number;
};

export function createDocumentsService(options: CreateDocumentsServiceOptions) {
  const repo = options.repo ?? {
    listDocumentRecords,
    getDocumentRecordById,
    createDocumentRecord,
    updateDocumentRecord,
    deleteDocumentRecord,
  };
  const generateId = options.generateId ?? nanoid;
  const tombstones = options.tombstones ?? {
    writeTombstone,
  };
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));

  return {
    async listDocuments(input: { includeContent: boolean }) {
      return repo.listDocumentRecords(input);
    },

    async getDocumentById(id: string) {
      return repo.getDocumentRecordById(id);
    },

    async createDocument(input: CreateDocumentInput) {
      const documentId = input.id ?? generateId();
      const currentTime = now();
      const doc = await repo.createDocumentRecord({
        id: documentId,
        title: input.title ?? "Untitled",
        content: input.content ?? "",
        collectionId: input.collectionId ?? null,
        isPublic: input.isPublic ?? false,
        sortOrder: input.sortOrder ?? 0,
        now: currentTime,
      });

      await options.searchIndex.syncDocument(documentId);
      return doc;
    },

    async updateDocument(id: string, input: UpdateDocumentInput) {
      const updates: UpdateDocumentRecordInput = {};
      const shouldBumpUpdatedAt =
        input.title !== undefined ||
        input.content !== undefined ||
        input.collectionId !== undefined ||
        input.sortOrder !== undefined ||
        input.isPublic !== undefined;

      if (input.title !== undefined) {
        updates.title = input.title;
      }
      if (input.content !== undefined) {
        updates.content = input.content;
      }
      if (input.collectionId !== undefined) updates.collectionId = input.collectionId;
      if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
      if (input.isPublic !== undefined) updates.isPublic = input.isPublic;
      if (shouldBumpUpdatedAt) updates.updatedAt = now();

      if (Object.keys(updates).length === 0) {
        return repo.getDocumentRecordById(id);
      }

      const doc = await repo.updateDocumentRecord(id, updates, {
        baseUpdatedAt: input.baseUpdatedAt,
      });
      if (!doc) return null;

      await options.searchIndex.syncDocument(id);
      return doc;
    },

    async deleteDocument(id: string) {
      const existing = await repo.getDocumentRecordById(id);
      if (!existing) {
        return { success: false as const, reason: "not_found" as const };
      }

      await tombstones.writeTombstone("document", id, now());
      await repo.deleteDocumentRecord(id);

      try {
        await options.searchIndex.removeDocument(id);
      } catch {
        // Best effort cleanup after source delete.
      }

      return { success: true as const };
    },
  };
}

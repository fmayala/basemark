import { nanoid } from "nanoid";
import {
  createDocumentRecord,
  deleteDocumentRecord,
  getDocumentRecordById,
  listDocumentRecords,
  updateDocumentRecord,
  type UpdateDocumentRecordInput,
} from "@/domain/repos/documents-repo";

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

type CreateDocumentsServiceOptions = {
  repo?: DocumentsRepo;
  searchIndex: SearchIndexAdapter;
  generateId?: () => string;
  now?: () => number;
};

type CreateDocumentInput = {
  title?: string;
  content?: string;
  collectionId?: string | null;
  sortOrder?: number;
};

type UpdateDocumentInput = {
  title?: string;
  content?: string;
  collectionId?: string | null;
  sortOrder?: number;
  isPublic?: boolean;
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
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));

  return {
    async listDocuments(input: { includeContent: boolean }) {
      return repo.listDocumentRecords(input);
    },

    async getDocumentById(id: string) {
      return repo.getDocumentRecordById(id);
    },

    async createDocument(input: CreateDocumentInput) {
      const documentId = generateId();
      const currentTime = now();
      const doc = await repo.createDocumentRecord({
        id: documentId,
        title: input.title ?? "Untitled",
        content: input.content ?? "",
        collectionId: input.collectionId ?? null,
        sortOrder: input.sortOrder ?? 0,
        now: currentTime,
      });

      await options.searchIndex.syncDocument(documentId);
      return doc;
    },

    async updateDocument(id: string, input: UpdateDocumentInput) {
      const updates: UpdateDocumentRecordInput = {};
      if (input.title !== undefined) {
        updates.title = input.title;
        updates.updatedAt = now();
      }
      if (input.content !== undefined) {
        updates.content = input.content;
        updates.updatedAt = now();
      }
      if (input.collectionId !== undefined) updates.collectionId = input.collectionId;
      if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
      if (input.isPublic !== undefined) updates.isPublic = input.isPublic;

      if (Object.keys(updates).length === 0) {
        return repo.getDocumentRecordById(id);
      }

      const doc = await repo.updateDocumentRecord(id, updates);
      if (!doc) return null;

      await options.searchIndex.syncDocument(id);
      return doc;
    },

    async deleteDocument(id: string) {
      const deleted = await repo.deleteDocumentRecord(id);
      if (!deleted) {
        return { success: false as const, reason: "not_found" as const };
      }

      try {
        await options.searchIndex.removeDocument(id);
      } catch {
        // Best effort cleanup after source delete.
      }

      return { success: true as const };
    },
  };
}

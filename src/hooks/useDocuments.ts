"use client";

import { useState, useEffect, useCallback } from "react";

const DOCUMENT_SYNC_EVENT = "outline:document-sync";

type DocumentSyncPayload = {
  id: string;
  title?: string;
  content?: string;
  collectionId?: string | null;
  updatedAt?: number;
};

function isDocumentSyncPayload(value: unknown): value is DocumentSyncPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Record<string, unknown>;
  if (typeof payload.id !== "string") return false;
  if ("title" in payload && typeof payload.title !== "string") return false;
  if ("content" in payload && typeof payload.content !== "string") return false;
  if (
    "collectionId" in payload &&
    payload.collectionId !== null &&
    typeof payload.collectionId !== "string"
  ) {
    return false;
  }
  if ("updatedAt" in payload && typeof payload.updatedAt !== "number") return false;

  return true;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  collectionId: string | null;
  isPublic: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        const normalized = Array.isArray(data)
          ? data.map((doc) => {
              const row = doc as Omit<Document, "content" | "isPublic"> & { content?: string; isPublic?: boolean };
              return {
                ...row,
                content: typeof row.content === "string" ? row.content : "",
                isPublic: !!row.isPublic,
              };
            })
          : [];
        setDocuments(normalized);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleDocumentSync = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail;
      if (!isDocumentSyncPayload(detail)) return;

      const updates: Partial<Document> = {};
      if (typeof detail.title === "string") updates.title = detail.title;
      if (typeof detail.content === "string") updates.content = detail.content;
      if (detail.collectionId === null || typeof detail.collectionId === "string") {
        updates.collectionId = detail.collectionId;
      }
      if (typeof detail.updatedAt === "number") updates.updatedAt = detail.updatedAt;

      if (Object.keys(updates).length === 0) return;

      setDocuments((prev) => {
        let found = false;
        const next = prev.map((doc) => {
          if (doc.id !== detail.id) return doc;
          found = true;

          if (typeof detail.updatedAt === "number" && detail.updatedAt < doc.updatedAt) {
            return doc;
          }

          return { ...doc, ...updates };
        });

        return found ? next : prev;
      });
    };

    window.addEventListener(DOCUMENT_SYNC_EVENT, handleDocumentSync);
    return () => {
      window.removeEventListener(DOCUMENT_SYNC_EVENT, handleDocumentSync);
    };
  }, []);

  const createDocument = useCallback(
    async (opts?: {
      title?: string;
      content?: string;
      collectionId?: string | null;
    }): Promise<Document | null> => {
      try {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts ?? {}),
        });
        if (res.ok) {
          const doc: Document = await res.json();
          setDocuments((prev) => [doc, ...prev]);
          return doc;
        }
      } catch (err) {
        console.error("Failed to create document:", err);
      }
      return null;
    },
    [],
  );

  const updateDocument = useCallback(
    async (
      id: string,
      updates: Partial<Pick<Document, "title" | "content" | "collectionId" | "sortOrder" | "isPublic">>,
    ): Promise<Document | null> => {
      try {
        const res = await fetch(`/api/documents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const doc: Document = await res.json();
          setDocuments((prev) => {
            const next = prev.map((d) => (d.id === id ? doc : d));
            return [...next].sort(
              (a, b) => a.sortOrder - b.sortOrder || b.updatedAt - a.updatedAt,
            );
          });
          return doc;
        }
      } catch (err) {
        console.error("Failed to update document:", err);
      }
      return null;
    },
    [],
  );

  const deleteDocument = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/documents/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setDocuments((prev) => prev.filter((d) => d.id !== id));
          return true;
        }
      } catch (err) {
        console.error("Failed to delete document:", err);
      }
      return false;
    },
    [],
  );

  return { documents, loading, refresh, createDocument, updateDocument, deleteDocument };
}

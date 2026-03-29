"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DocTitle from "@/components/editor/DocTitle";
import Editor from "@/components/editor/Editor";
import {
  buildPendingSyncRecord,
  clearSyncedField,
  hasPendingFields,
} from "@/lib/client/editor-sync-engine";
import {
  clearPendingSync,
  readPendingSync,
  writePendingSync,
} from "@/lib/client/pending-sync-outbox";

const DOCUMENT_SYNC_EVENT = "outline:document-sync";

type DocumentSyncDetail = {
  id: string;
  title?: string;
  content?: string;
  collectionId?: string | null;
  updatedAt?: number;
};

function dispatchDocumentSync(detail: DocumentSyncDetail) {
  window.dispatchEvent(new CustomEvent(DOCUMENT_SYNC_EVENT, { detail }));
}

interface Doc {
  id: string;
  title: string;
  content: string;
  collectionId?: string | null;
  updatedAt?: number;
}

interface DocEditorProps {
  initialDoc: Doc;
  initialCollectionName: string | null;
}

type PersistOptions = {
  flush?: boolean;
};

export default function DocEditor({ initialDoc, initialCollectionName }: DocEditorProps) {
  const [title, setTitle] = useState(initialDoc.title ?? "");
  const [content, setContent] = useState(initialDoc.content ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const collectionName = initialCollectionName;
  const id = initialDoc.id;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTitleRef = useRef<string | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const titleRequestIdRef = useRef(0);
  const contentRequestIdRef = useRef(0);
  const titleAbortRef = useRef<AbortController | null>(null);
  const contentAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const inFlightSavesRef = useRef(0);
  const latestUpdatedAtRef = useRef<number | null>(
    typeof initialDoc.updatedAt === "number" ? initialDoc.updatedAt : null,
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const dispatchSaveStatus = useCallback((status: "saving" | "saved" | "error", message?: string) => {
    window.dispatchEvent(new CustomEvent("basemark:save-status", { detail: { status, message } }));
  }, []);

  const beginSave = useCallback(() => {
    inFlightSavesRef.current += 1;
    if (!mountedRef.current) return;
    setIsSaving(true);
    setSaveError(null);
    dispatchSaveStatus("saving");
  }, [dispatchSaveStatus]);

  const endSave = useCallback(() => {
    inFlightSavesRef.current = Math.max(0, inFlightSavesRef.current - 1);
    if (!mountedRef.current) return;
    if (inFlightSavesRef.current === 0) {
      setIsSaving(false);
      dispatchSaveStatus("saved");
    }
  }, [dispatchSaveStatus]);

  const queuePendingField = useCallback(
    (field: "title" | "content", value: string, lastError?: string) => {
      const current = readPendingSync(id);
      const next = buildPendingSyncRecord({
        docId: id,
        field,
        value,
        current,
      });

      if (lastError) {
        next.retryCount = (current?.retryCount ?? 0) + 1;
        next.lastError = lastError;
      }

      writePendingSync(next);
    },
    [id],
  );

  const ackPendingField = useCallback(
    (field: "title" | "content", syncedValue: string) => {
      const current = readPendingSync(id);
      if (!current) return;

      const next = clearSyncedField(current, field, syncedValue);
      if (next === current) return;

      if (hasPendingFields(next)) {
        writePendingSync(next);
      } else {
        clearPendingSync(id);
      }
    },
    [id],
  );

  // Dispatch initial sync so sidebar stays up-to-date
  useEffect(() => {
    dispatchDocumentSync({
      id: initialDoc.id,
      title: initialDoc.title ?? "",
      content: initialDoc.content ?? "",
      collectionId: initialDoc.collectionId ?? null,
      ...(typeof initialDoc.updatedAt === "number" ? { updatedAt: initialDoc.updatedAt } : {}),
    });
  }, [
    initialDoc.collectionId,
    initialDoc.content,
    initialDoc.id,
    initialDoc.title,
    initialDoc.updatedAt,
  ]);

  const persistTitle = useCallback(
    async (value: string, options: PersistOptions = {}) => {
      const requestId = titleRequestIdRef.current + 1;
      titleRequestIdRef.current = requestId;

      titleAbortRef.current?.abort();
      const controller = new AbortController();
      titleAbortRef.current = controller;

      beginSave();
      try {
        const payload: { title: string; baseUpdatedAt?: number } = { title: value };
        if (typeof latestUpdatedAtRef.current === "number") {
          payload.baseUpdatedAt = latestUpdatedAtRef.current;
        }

        const res = await fetch(`/api/documents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
          ...(options.flush ? { keepalive: true } : {}),
        });

        if (res.status === 409) {
          const conflict = (await res.json().catch(() => null)) as
            | { document?: { updatedAt?: number } }
            | null;
          if (typeof conflict?.document?.updatedAt === "number") {
            latestUpdatedAtRef.current = conflict.document.updatedAt;
          }
          throw new Error("Title save conflict");
        }

        if (!res.ok) {
          throw new Error(`Title save failed (${res.status})`);
        }
        if (requestId !== titleRequestIdRef.current) return;
        const data = (await res.json().catch(() => null)) as
          | { id?: string; updatedAt?: number }
          | null;
        if (requestId !== titleRequestIdRef.current) return;

        if (typeof data?.updatedAt === "number") {
          latestUpdatedAtRef.current = data.updatedAt;
        }

        dispatchDocumentSync({
          id,
          title: value,
          ...(typeof data?.updatedAt === "number" ? { updatedAt: data.updatedAt } : {}),
        });

        ackPendingField("title", value);
        if (pendingTitleRef.current === value) {
          pendingTitleRef.current = null;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (requestId !== titleRequestIdRef.current) return;
        if (!mountedRef.current) return;
        queuePendingField("title", value, "title_save_failed");
        setSaveError("Failed to save changes. Your latest edits are still local.");
        dispatchSaveStatus("error", "Save failed - edits are local");
      } finally {
        endSave();
      }
    },
    [ackPendingField, beginSave, dispatchSaveStatus, endSave, id, queuePendingField],
  );

  const persistContent = useCallback(
    async (value: string, options: PersistOptions = {}) => {
      const requestId = contentRequestIdRef.current + 1;
      contentRequestIdRef.current = requestId;

      contentAbortRef.current?.abort();
      const controller = new AbortController();
      contentAbortRef.current = controller;

      beginSave();
      try {
        const payload: { content: string; baseUpdatedAt?: number } = { content: value };
        if (typeof latestUpdatedAtRef.current === "number") {
          payload.baseUpdatedAt = latestUpdatedAtRef.current;
        }

        const res = await fetch(`/api/documents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
          ...(options.flush ? { keepalive: true } : {}),
        });

        if (res.status === 409) {
          const conflict = (await res.json().catch(() => null)) as
            | { document?: { updatedAt?: number } }
            | null;
          if (typeof conflict?.document?.updatedAt === "number") {
            latestUpdatedAtRef.current = conflict.document.updatedAt;
          }
          throw new Error("Content save conflict");
        }

        if (!res.ok) {
          throw new Error(`Content save failed (${res.status})`);
        }
        if (requestId !== contentRequestIdRef.current) return;
        const data = (await res.json().catch(() => null)) as
          | { id?: string; updatedAt?: number }
          | null;
        if (requestId !== contentRequestIdRef.current) return;

        if (typeof data?.updatedAt === "number") {
          latestUpdatedAtRef.current = data.updatedAt;
        }

        dispatchDocumentSync({
          id,
          content: value,
          ...(typeof data?.updatedAt === "number" ? { updatedAt: data.updatedAt } : {}),
        });

        ackPendingField("content", value);
        if (pendingContentRef.current === value) {
          pendingContentRef.current = null;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (requestId !== contentRequestIdRef.current) return;
        if (!mountedRef.current) return;
        queuePendingField("content", value, "content_save_failed");
        setSaveError("Failed to save changes. Your latest edits are still local.");
        dispatchSaveStatus("error", "Save failed - edits are local");
      } finally {
        endSave();
      }
    },
    [ackPendingField, beginSave, dispatchSaveStatus, endSave, id, queuePendingField],
  );

  const replayPendingSync = useCallback(() => {
    const pending = readPendingSync(id);
    if (!pending) return;

    if (pending.pendingTitle !== undefined) {
      setTitle(pending.pendingTitle);
      pendingTitleRef.current = pending.pendingTitle;
      void persistTitle(pending.pendingTitle, { flush: true });
    }
    if (pending.pendingContent !== undefined) {
      setContent(pending.pendingContent);
      pendingContentRef.current = pending.pendingContent;
      void persistContent(pending.pendingContent, { flush: true });
    }
  }, [id, persistContent, persistTitle]);

  useEffect(() => {
    replayPendingSync();
  }, [replayPendingSync]);

  const flushPendingSaves = useCallback(() => {
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = null;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const pendingTitle = pendingTitleRef.current;
    const pendingContent = pendingContentRef.current;
    pendingTitleRef.current = null;
    pendingContentRef.current = null;

    if (pendingTitle !== null) {
      void persistTitle(pendingTitle, { flush: true });
    }
    if (pendingContent !== null) {
      void persistContent(pendingContent, { flush: true });
    }
  }, [persistContent, persistTitle]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      dispatchDocumentSync({ id, title: newTitle });

      pendingTitleRef.current = newTitle;
      queuePendingField("title", newTitle);

      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = setTimeout(() => {
        const value = pendingTitleRef.current;
        if (value !== null) {
          void persistTitle(value);
        }
      }, 300);
    },
    [id, persistTitle, queuePendingField],
  );

  const handleContentUpdate = useCallback(
    (newContent: string) => {
      setContent(newContent);

      pendingContentRef.current = newContent;
      queuePendingField("content", newContent);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const value = pendingContentRef.current;
        if (value !== null) {
          void persistContent(value);
        }
      }, 500);
    },
    [persistContent, queuePendingField],
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSaves();
      } else {
        replayPendingSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushPendingSaves, replayPendingSync]);

  useEffect(() => {
    return () => {
      flushPendingSaves();
    };
  }, [flushPendingSaves]);

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-8 lg:px-14 py-12">
      {collectionName && (
        <div className="text-xs text-text-ghost mb-4 tracking-wide">{collectionName}</div>
      )}
      <DocTitle title={title} onChange={handleTitleChange} />
      <Editor content={content} onUpdate={handleContentUpdate} docId={id} />
      {isSaving && !saveError && <p className="sr-only">Saving...</p>}
    </div>
  );
}

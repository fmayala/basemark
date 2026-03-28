"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DocTitle from "@/components/editor/DocTitle";
import Editor from "@/components/editor/Editor";

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
        const res = await fetch(`/api/documents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: value }),
          signal: controller.signal,
          ...(options.flush ? { keepalive: true } : {}),
        });

        if (!res.ok) {
          throw new Error(`Title save failed (${res.status})`);
        }
        if (requestId !== titleRequestIdRef.current) return;
        const data = (await res.json().catch(() => null)) as
          | { id?: string; updatedAt?: number }
          | null;
        if (requestId !== titleRequestIdRef.current) return;

        dispatchDocumentSync({
          id,
          title: value,
          ...(typeof data?.updatedAt === "number" ? { updatedAt: data.updatedAt } : {}),
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (requestId !== titleRequestIdRef.current) return;
        if (!mountedRef.current) return;
        setSaveError("Failed to save changes. Your latest edits are still local.");
        dispatchSaveStatus("error", "Save failed — edits are local");
      } finally {
        endSave();
      }
    },
    [beginSave, endSave, id],
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
        const res = await fetch(`/api/documents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: value }),
          signal: controller.signal,
          ...(options.flush ? { keepalive: true } : {}),
        });

        if (!res.ok) {
          throw new Error(`Content save failed (${res.status})`);
        }
        if (requestId !== contentRequestIdRef.current) return;
        const data = (await res.json().catch(() => null)) as
          | { id?: string; updatedAt?: number }
          | null;
        if (requestId !== contentRequestIdRef.current) return;

        dispatchDocumentSync({
          id,
          content: value,
          ...(typeof data?.updatedAt === "number" ? { updatedAt: data.updatedAt } : {}),
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (requestId !== contentRequestIdRef.current) return;
        if (!mountedRef.current) return;
        setSaveError("Failed to save changes. Your latest edits are still local.");
        dispatchSaveStatus("error", "Save failed — edits are local");
      } finally {
        endSave();
      }
    },
    [beginSave, endSave, id],
  );

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

  // Save title with 300ms debounce
  // Sync browser tab title
  useEffect(() => {
    document.title = title ? `${title} - Basemark` : "Basemark";
    return () => { document.title = "Basemark"; };
  }, [title]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      dispatchDocumentSync({ id, title: newTitle });

      pendingTitleRef.current = newTitle;
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = setTimeout(() => {
        const value = pendingTitleRef.current;
        pendingTitleRef.current = null;
        if (value !== null) {
          void persistTitle(value);
        }
      }, 300);
    },
    [id, persistTitle],
  );

  // Save content with 500ms debounce
  const handleContentUpdate = useCallback(
    (newContent: string) => {
      setContent(newContent);

      pendingContentRef.current = newContent;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const value = pendingContentRef.current;
        pendingContentRef.current = null;
        if (value !== null) {
          void persistContent(value);
        }
      }, 500);
    },
    [persistContent],
  );

  // Flush pending changes when tab is backgrounded.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSaves();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushPendingSaves]);

  // Flush pending debounced writes on unmount.
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
    </div>
  );
}

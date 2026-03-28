"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DocTitle from "@/components/editor/DocTitle";
import Editor from "@/components/editor/Editor";
import MobileFormatToolbar from "@/components/mobile/MobileFormatToolbar";
import ShareDialog from "@/components/share/ShareDialog";
import { Button } from "@/components/ui/button";
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
  isPublic?: boolean;
}

interface MobileEditorProps {
  docId: string;
  onBack: () => void;
  onShare: () => void;
}

export default function MobileEditor({ docId, onBack, onShare }: MobileEditorProps) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsent, setHasUnsent] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [shareOpen, setShareOpen] = useState(false);

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

  const hasPersistedUnsent = useCallback(() => {
    const pending = readPendingSync(docId);
    return Boolean(pending?.pendingTitle !== undefined || pending?.pendingContent !== undefined);
  }, [docId]);

  const syncSaveUiState = useCallback(
    (errorMessage: string | null = null) => {
      const inFlight = inFlightSavesRef.current > 0;
      const unsent =
        hasPersistedUnsent() ||
        pendingTitleRef.current !== null ||
        pendingContentRef.current !== null;

      setIsSaving(inFlight);
      setHasUnsent(unsent);

      if (inFlight) {
        setSaveError(null);
        return;
      }

      if (errorMessage) {
        setSaveError(errorMessage);
        return;
      }

      setSaveError(null);
    },
    [hasPersistedUnsent],
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const beginSave = useCallback(() => {
    inFlightSavesRef.current += 1;
    if (!mountedRef.current) return;
    syncSaveUiState();
  }, [syncSaveUiState]);

  const endSave = useCallback(() => {
    inFlightSavesRef.current = Math.max(0, inFlightSavesRef.current - 1);
    if (!mountedRef.current) return;
    syncSaveUiState();
  }, [syncSaveUiState]);

  const persistTitle = useCallback(
    async (value: string, options?: { flush?: boolean }) => {
      const requestId = titleRequestIdRef.current + 1;
      titleRequestIdRef.current = requestId;

      titleAbortRef.current?.abort();
      const controller = new AbortController();
      titleAbortRef.current = controller;

      beginSave();
      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: value }),
          signal: controller.signal,
          ...(options?.flush ? { keepalive: true } : {}),
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
          id: docId,
          title: value,
          ...(typeof data?.updatedAt === "number" ? { updatedAt: data.updatedAt } : {}),
        });

        const current = readPendingSync(docId);
        if (current) {
          writePendingSync({
            ...current,
            pendingTitle: undefined,
            clientUpdatedAt: Date.now(),
            lastError: undefined,
          });
          const next = readPendingSync(docId);
          if (next?.pendingTitle === undefined && next?.pendingContent === undefined) {
            clearPendingSync(docId);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (requestId !== titleRequestIdRef.current) return;
        if (!mountedRef.current) return;
        syncSaveUiState("Failed to save changes. Your latest edits are still local.");
      } finally {
        endSave();
      }
    },
    [beginSave, docId, endSave, syncSaveUiState],
  );

  const persistContent = useCallback(
    async (value: string, options?: { flush?: boolean }) => {
      const requestId = contentRequestIdRef.current + 1;
      contentRequestIdRef.current = requestId;

      contentAbortRef.current?.abort();
      const controller = new AbortController();
      contentAbortRef.current = controller;

      beginSave();
      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: value }),
          signal: controller.signal,
          ...(options?.flush ? { keepalive: true } : {}),
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
          id: docId,
          content: value,
          ...(typeof data?.updatedAt === "number" ? { updatedAt: data.updatedAt } : {}),
        });

        const current = readPendingSync(docId);
        if (current) {
          writePendingSync({
            ...current,
            pendingContent: undefined,
            clientUpdatedAt: Date.now(),
            lastError: undefined,
          });
          const next = readPendingSync(docId);
          if (next?.pendingTitle === undefined && next?.pendingContent === undefined) {
            clearPendingSync(docId);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (requestId !== contentRequestIdRef.current) return;
        if (!mountedRef.current) return;
        syncSaveUiState("Failed to save changes. Your latest edits are still local.");
      } finally {
        endSave();
      }
    },
    [beginSave, docId, endSave, syncSaveUiState],
  );

  const replayPendingSync = useCallback(() => {
    const pending = readPendingSync(docId);
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
  }, [docId, persistContent, persistTitle]);

  useEffect(() => {
    syncSaveUiState();
  }, [syncSaveUiState]);

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

  // Fetch doc on mount and when docId changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDoc(null);
    setEditorInstance(null);

    fetch(`/api/documents/${docId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch document");
        return res.json() as Promise<Doc>;
      })
      .then((data) => {
        if (cancelled) return;
        setDoc(data);
        setTitle(data.title ?? "");
        setContent(data.content ?? "");
        replayPendingSync();
        syncSaveUiState();
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      flushPendingSaves();
    };
  }, [docId, flushPendingSaves, replayPendingSync, syncSaveUiState]);

  // Save title with 300ms debounce
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);

      const current = readPendingSync(docId);
      writePendingSync({
        docId,
        pendingTitle: newTitle,
        pendingContent: pendingContentRef.current ?? current?.pendingContent,
        clientUpdatedAt: Date.now(),
        retryCount: current?.retryCount,
        lastError: current?.lastError,
      });
      syncSaveUiState();

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
    [docId, persistTitle, syncSaveUiState],
  );

  // Save content with 500ms debounce
  const handleContentUpdate = useCallback(
    (newContent: string) => {
      setContent(newContent);

      const current = readPendingSync(docId);
      writePendingSync({
        docId,
        pendingTitle: pendingTitleRef.current ?? current?.pendingTitle,
        pendingContent: newContent,
        clientUpdatedAt: Date.now(),
        retryCount: current?.retryCount,
        lastError: current?.lastError,
      });
      syncSaveUiState();

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
    [docId, persistContent, syncSaveUiState],
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSaves();
        return;
      }

      replayPendingSync();
      syncSaveUiState();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushPendingSaves, replayPendingSync, syncSaveUiState]);

  return (
    <div className="flex flex-col h-full w-full bg-bg-primary">
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-2 flex-shrink-0 border-b border-border-subtle">
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Go back"
          className="w-11 h-11"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12.5 15L7.5 10L12.5 5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>

        {/* Right action buttons */}
        <div className="flex items-center">
          {/* Share button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShareOpen(true)}
            aria-label="Share document"
            className="w-11 h-11"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M14 6.5C15.1046 6.5 16 5.60457 16 4.5C16 3.39543 15.1046 2.5 14 2.5C12.8954 2.5 12 3.39543 12 4.5C12 5.60457 12.8954 6.5 14 6.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 11C7.10457 11 8 10.1046 8 9C8 7.89543 7.10457 7 6 7C4.89543 7 4 7.89543 4 9C4 10.1046 4.89543 11 6 11Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 17.5C15.1046 17.5 16 16.6046 16 15.5C16 14.3954 15.1046 13.5 14 13.5C12.8954 13.5 12 14.3954 12 15.5C12 16.6046 12.8954 17.5 14 17.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7.83325 10.0833L12.1666 14.4167M12.1666 3.58333L7.83325 7.91667"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>

          {/* More (⋯) button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="More options"
            className="w-11 h-11"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="5" cy="10" r="1.5" fill="currentColor" />
              <circle cx="10" cy="10" r="1.5" fill="currentColor" />
              <circle cx="15" cy="10" r="1.5" fill="currentColor" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-text-ghost border-t-text-secondary rounded-full animate-spin" />
          </div>
        ) : doc ? (
          <>
            <DocTitle title={title} onChange={handleTitleChange} />
            {isSaving && !saveError && (
              <p className="mt-2 mb-3 text-xs text-text-faint" aria-live="polite">
                Saving...
              </p>
            )}
            {saveError && (
              <p className="mt-2 mb-3 text-xs text-danger" role="alert">
                {saveError}
              </p>
            )}
            {!isSaving && !saveError && hasUnsent && (
              <p className="mt-2 mb-3 text-xs text-text-faint" aria-live="polite">
                Unsent changes are queued locally. Reopen this document to retry sync.
              </p>
            )}
            <Editor content={content} onUpdate={handleContentUpdate} docId={docId} onReady={setEditorInstance} />
          </>
        ) : (
          <div className="text-text-secondary text-sm text-center py-12">
            Failed to load document.
          </div>
        )}
      </div>
      <MobileFormatToolbar editor={editorInstance} />
      <ShareDialog
        documentId={docId}
        isPublic={doc?.isPublic ?? false}
        onTogglePublic={async (val) => {
          const res = await fetch(`/api/documents/${docId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPublic: val }),
          });
          if (!res.ok) {
            setSaveError("Failed to update share visibility.");
            return;
          }
          setDoc(prev => prev ? { ...prev, isPublic: val } : prev);
        }}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}

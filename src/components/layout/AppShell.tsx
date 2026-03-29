"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { extractText } from "@/lib/text";
import { useRouter, usePathname } from "next/navigation";
import { useDocuments, type Document } from "@/hooks/useDocuments";
import { useCollections } from "@/hooks/useCollections";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";
import StatusBar from "./StatusBar";
import CommandPalette from "@/components/ui/CommandPalette";
import ShareDialog from "@/components/share/ShareDialog";

const SIDEBAR_WIDTH = 260;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // ---- Sidebar state (persisted to localStorage, auto-hides on mobile) ----
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) return false;
      return localStorage.getItem("sidebarOpen") !== "false";
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("sidebarOpen", String(sidebarOpen));
  }, [sidebarOpen]);

  // Auto-hide sidebar when viewport shrinks below 768px
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // ---- Data ----
  const { documents, createDocument, updateDocument, deleteDocument, refresh: refreshDocuments } = useDocuments();
  const { collections, createCollection, updateCollection, deleteCollection, refresh: refreshCollections } = useCollections();

  // ---- Active doc from URL ----
  const activeDocId = pathname.startsWith("/doc/")
    ? pathname.slice(5) // "/doc/abc" -> "abc"
    : null;

  // ---- Open tabs ----
  const [openTabs, setOpenTabs] = useState<{ id: string; title: string }[]>(
    [],
  );

  // ---- Closed tabs stack (for Ctrl+Shift+T reopen) ----
  const [closedTabs, setClosedTabs] = useState<{ id: string; title: string }[]>([]);

  // If activeDocId is set but not in tabs, add it
  useEffect(() => {
    if (activeDocId) {
      setOpenTabs((prev) => {
        if (prev.some((t) => t.id === activeDocId)) return prev;
        const doc = documents.find((d) => d.id === activeDocId);
        const title = doc?.title || "Untitled";
        return [...prev, { id: activeDocId, title }];
      });
    }
  }, [activeDocId, documents]);

  // Keep tab titles in sync with document titles
  useEffect(() => {
    setOpenTabs((prev) =>
      prev.map((tab) => {
        const doc = documents.find((d) => d.id === tab.id);
        if (doc && doc.title !== tab.title) {
          return { ...tab, title: doc.title };
        }
        return tab;
      }),
    );
  }, [documents]);

  // Listen for document-sync events to update tab titles immediately
  useEffect(() => {
    function handleSync(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.id && detail?.title !== undefined) {
        setOpenTabs((prev) =>
          prev.map((tab) =>
            tab.id === detail.id && tab.title !== detail.title
              ? { ...tab, title: detail.title }
              : tab
          ),
        );
      }
    }
    window.addEventListener("outline:document-sync", handleSync);
    return () => window.removeEventListener("outline:document-sync", handleSync);
  }, []);

  // ---- Handlers ----
  const handleDocClick = useCallback(
    (doc: { id: string; title: string }) => {
      setOpenTabs((prev) => {
        if (prev.some((t) => t.id === doc.id)) return prev;
        return [...prev, { id: doc.id, title: doc.title || "Untitled" }];
      });
      router.push(`/doc/${doc.id}`);
    },
    [router],
  );

  const handleTabClick = useCallback(
    (id: string) => {
      router.push(`/doc/${id}`);
    },
    [router],
  );

  const handleTabClose = useCallback(
    (id: string) => {
      // Read current tabs to compute navigation target *before* updating state
      const closing = openTabs.find((t) => t.id === id);
      if (closing) {
        setClosedTabs((stack) => [closing, ...stack].slice(0, 10));
      }
      const next = openTabs.filter((t) => t.id !== id);
      setOpenTabs(next);

      // Navigate after state update — not inside a setState updater
      if (id === activeDocId) {
        const idx = openTabs.findIndex((t) => t.id === id);
        const neighbor = next[Math.min(idx, next.length - 1)];
        if (neighbor) {
          router.push(`/doc/${neighbor.id}`);
        } else {
          router.push("/");
        }
      }
    },
    [activeDocId, openTabs, router],
  );

  const handleNewTab = useCallback(async () => {
    const doc = await createDocument({ title: "Untitled" });
    if (doc) {
      setOpenTabs((prev) => [...prev, { id: doc.id, title: doc.title }]);
      router.push(`/doc/${doc.id}`);
    }
  }, [createDocument, router]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // ---- Command palette ----
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // ---- Share ----
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const handleShare = useCallback(() => {
    if (activeDocId) setShareDocId(activeDocId);
  }, [activeDocId]);

  const handlePaletteSelect = useCallback(
    (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (doc) handleDocClick({ id: doc.id, title: doc.title });
    },
    [documents, handleDocClick],
  );

  // ---- Sidebar search focus signal ----
  const [focusSearchSignal, setFocusSearchSignal] = useState(0);

  const focusSearch = useCallback(() => {
    // Ensure sidebar is open, then signal the search input to focus
    setSidebarOpen(true);
    setFocusSearchSignal((prev) => prev + 1);
  }, []);

  // ---- Tab keyboard helpers ----
  const closeActiveTab = useCallback(() => {
    if (!activeDocId || openTabs.length === 0) return;
    handleTabClose(activeDocId);
  }, [activeDocId, openTabs, handleTabClose]);

  const reopenLastClosedTab = useCallback(() => {
    if (closedTabs.length === 0) return;
    const [tab, ...rest] = closedTabs;
    setClosedTabs(rest);
    setOpenTabs((prev) => [...prev, tab]);
    router.push(`/doc/${tab.id}`);
  }, [closedTabs, router]);

  const nextTab = useCallback(() => {
    if (openTabs.length < 2) return;
    const idx = openTabs.findIndex((t) => t.id === activeDocId);
    const next = (idx + 1) % openTabs.length;
    router.push(`/doc/${openTabs[next].id}`);
  }, [openTabs, activeDocId, router]);

  const prevTab = useCallback(() => {
    if (openTabs.length < 2) return;
    const idx = openTabs.findIndex((t) => t.id === activeDocId);
    const prev = (idx - 1 + openTabs.length) % openTabs.length;
    router.push(`/doc/${openTabs[prev].id}`);
  }, [openTabs, activeDocId, router]);

  const goToTab = useCallback(
    (index: number) => {
      if (index >= openTabs.length) return;
      router.push(`/doc/${openTabs[index].id}`);
    },
    [openTabs, router],
  );

  const goToLastTab = useCallback(() => {
    if (openTabs.length === 0) return;
    router.push(`/doc/${openTabs[openTabs.length - 1].id}`);
  }, [openTabs, router]);

  // ---- Keyboard shortcuts ----
  const shortcuts = useMemo(
    () => ({
      "ctrl+k": openPalette,
      "ctrl+n": handleNewTab,
      "ctrl+shift+f": focusSearch,
      "ctrl+\\": toggleSidebar,
      // Tab management (Ctrl+W works in PWA standalone; Alt+W is the browser-safe fallback)
      "ctrl+w": closeActiveTab,
      "alt+w": closeActiveTab,
      "ctrl+shift+t": reopenLastClosedTab,
      "alt+]": nextTab,
      "alt+[": prevTab,
      "ctrl+.": nextTab,
      "ctrl+,": prevTab,
      "ctrl+1": () => goToTab(0),
      "ctrl+2": () => goToTab(1),
      "ctrl+3": () => goToTab(2),
      "ctrl+4": () => goToTab(3),
      "ctrl+5": () => goToTab(4),
      "ctrl+6": () => goToTab(5),
      "ctrl+7": () => goToTab(6),
      "ctrl+8": () => goToTab(7),
      "ctrl+9": goToLastTab,
    }),
    [
      openPalette,
      handleNewTab,
      focusSearch,
      toggleSidebar,
      closeActiveTab,
      reopenLastClosedTab,
      nextTab,
      prevTab,
      goToTab,
      goToLastTab,
    ],
  );

  useKeyboardShortcuts(shortcuts);

  // ---- Word/char count from active doc ----
  const activeDoc = documents.find((d) => d.id === activeDocId);
  const plainText = useMemo(() => {
    if (!activeDoc?.content) return "";
    try {
      return extractText(JSON.parse(activeDoc.content));
    } catch {
      return "";
    }
  }, [activeDoc?.content]);
  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
  const charCount = plainText.length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-sidebar">
      {/* Tab bar row */}
      <TabBar
        tabs={openTabs}
        activeTabId={activeDocId}
        sidebarOpen={sidebarOpen}
        sidebarWidth={SIDEBAR_WIDTH}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onToggleSidebar={toggleSidebar}
        onNewTab={handleNewTab}
        onShare={handleShare}
      />

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className="overflow-hidden transition-[width] duration-200 ease-in-out shrink-0"
          style={{ width: sidebarOpen ? SIDEBAR_WIDTH : 0 }}
        >
          <Sidebar
            collections={collections}
            documents={documents}
            activeDocId={activeDocId}
            onDocClick={handleDocClick}
            focusSearchSignal={focusSearchSignal}
            onDocRename={async (id, title) => { await updateDocument(id, { title }); }}
            onDocDelete={async (id) => {
              const deleted = await deleteDocument(id);
              if (!deleted) return;

              const nextTabs = openTabs.filter((t) => t.id !== id);
              setOpenTabs(nextTabs);
              setClosedTabs((prev) => prev.filter((t) => t.id !== id));

              if (id === activeDocId) {
                const idx = openTabs.findIndex((t) => t.id === id);
                const neighbor = nextTabs[Math.min(idx, nextTabs.length - 1)];
                router.push(neighbor ? `/doc/${neighbor.id}` : "/");
              }
            }}
            onDocMove={async (id, collectionId) => { await updateDocument(id, { collectionId }); }}
            onDocUpdate={async (id, updates) => { await updateDocument(id, updates); }}
            onDocReorder={async (updates) => {
              try {
                await Promise.all(
                  updates.map((u) =>
                    updateDocument(u.id, {
                      sortOrder: u.sortOrder,
                      ...(u.collectionId !== undefined ? { collectionId: u.collectionId } : {}),
                    }),
                  ),
                );
              } catch (err) {
                console.error("Doc reorder failed, refreshing:", err);
                await refreshDocuments();
              }
            }}
            onCollectionCreate={async (name) => { await createCollection({ name }); }}
            onCollectionRename={async (id, name) => { await updateCollection(id, { name }); }}
            onCollectionReorder={async (updates) => {
              try {
                await Promise.all(
                  updates.map((u) => updateCollection(u.id, { sortOrder: u.sortOrder })),
                );
              } catch (err) {
                console.error("Collection reorder failed, refreshing:", err);
                await refreshCollections();
              }
            }}
            onCollectionDelete={async (id) => {
              await deleteCollection(id);
              await refreshDocuments(); // re-fetch docs so stale collectionIds update to null
            }}
          />
        </div>

        {/* Content area */}
        <div className="content-area flex-1 flex flex-col bg-bg-primary relative overflow-hidden">
          <div className="flex-1 overflow-auto">{children}</div>
          {activeDocId && (
            <StatusBar wordCount={wordCount} charCount={charCount} updatedAt={activeDoc?.updatedAt} />
          )}
        </div>
      </div>
      {/* Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        documents={documents}
        onSelect={handlePaletteSelect}
        onNewDoc={handleNewTab}
        onToggleSidebar={toggleSidebar}
        onFocusSearch={focusSearch}
      />
      {shareDocId && (
        <ShareDialog
          documentId={shareDocId}
          isPublic={!!documents.find((d) => d.id === shareDocId)?.isPublic}
          onTogglePublic={async (pub) => {
            await updateDocument(shareDocId, { isPublic: pub });
          }}
          open={true}
          onClose={() => setShareDocId(null)}
        />
      )}
    </div>
  );
}

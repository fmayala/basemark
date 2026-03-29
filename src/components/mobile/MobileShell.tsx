"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useDocuments } from "@/hooks/useDocuments";
import { useCollections } from "@/hooks/useCollections";
import {
  MOBILE_SEARCH_PARAM,
  buildCloseSearchHref,
  buildOpenSearchHref,
} from "./mobile-navigation-state";
import MobileSearch from "./MobileSearch";
import MobileEditor from "./MobileEditor";
import { MobileNotesList } from "./MobileNotesList";

type Screen = "list" | "editor" | "search";

export default function MobileShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { documents, createDocument, deleteDocument } = useDocuments();
  const { collections } = useCollections();

  const activeDocId = pathname.startsWith("/doc/") ? pathname.slice(5) : null;
  const screen: Screen = searchParams.get(MOBILE_SEARCH_PARAM) === "1"
    ? "search"
    : activeDocId
      ? "editor"
      : "list";

  const onOpenDoc = useCallback((id: string) => {
    router.push(`/doc/${id}`);
  }, [router]);

  const onBack = useCallback(() => {
    router.push("/");
  }, [router]);

  const onOpenSearch = useCallback(() => {
    router.push(buildOpenSearchHref({ pathname, searchParams }));
  }, [pathname, router, searchParams]);

  const onCloseSearch = useCallback(() => {
    router.replace(buildCloseSearchHref({ pathname, searchParams }));
  }, [pathname, router, searchParams]);

  const onNewDoc = useCallback(async () => {
    const doc = await createDocument({ title: "Untitled" });
    if (doc) {
      router.push(`/doc/${doc.id}`);
    }
  }, [createDocument, router]);

  const onDeleteDoc = useCallback(
    async (id: string) => {
      await deleteDocument(id);
    },
    [deleteDocument],
  );

  return (
    <div className="h-screen w-screen bg-bg-primary flex flex-col overflow-hidden safe-top">
      {/* Content area — transitions happen here */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {screen === "list" && (
            <motion.div
              key="list"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              <MobileNotesList
                documents={documents}
                collections={collections}
                onOpenDoc={onOpenDoc}
                onDeleteDoc={onDeleteDoc}
              />
            </motion.div>
          )}

          {screen === "editor" && activeDocId && (
            <motion.div
              key={`editor-${activeDocId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              <MobileEditor
                docId={activeDocId}
                onBack={onBack}
                onShare={() => {}}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search overlays on top */}
        <AnimatePresence>
          {screen === "search" && (
            <motion.div
              key="search"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
              className="absolute inset-0 z-20 flex flex-col bg-bg-primary"
            >
              <MobileSearch
                onSelectResult={onOpenDoc}
                onClose={onCloseSearch}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom tab bar — ALWAYS visible */}
      <div className="h-14 bg-bg-sidebar border-t border-border/20 flex items-center justify-around px-4 shrink-0 safe-bottom">
        {/* Notes */}
        <button
          type="button"
          onClick={onBack}
          className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full bg-transparent border-none cursor-pointer transition-colors duration-100 ${
            screen === "list" ? "text-accent" : "text-text-faint active:text-text-primary"
          }`}
          aria-label="Notes"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="text-xs">Notes</span>
        </button>

        {/* Search */}
        <button
          type="button"
          onClick={onOpenSearch}
          className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full bg-transparent border-none cursor-pointer transition-colors duration-100 ${
            screen === "search" ? "text-accent" : "text-text-faint active:text-text-primary"
          }`}
          aria-label="Search"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-xs">Search</span>
        </button>

        {/* New note */}
        <button
          type="button"
          onClick={onNewDoc}
          className="flex flex-col items-center justify-center gap-0.5 w-16 h-full text-text-faint bg-transparent border-none cursor-pointer active:text-text-primary transition-colors duration-100"
          aria-label="New note"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-xs">New</span>
        </button>
      </div>
    </div>
  );
}

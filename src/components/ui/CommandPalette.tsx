"use client";

import { useEffect } from "react";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Document } from "@/hooks/useDocuments";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  documents: Document[];
  onSelect: (docId: string) => void;
  onNewDoc: () => void;
  onToggleSidebar: () => void;
  onFocusSearch: () => void;
}

export default function CommandPalette({
  open, onClose, documents, onSelect, onNewDoc, onToggleSidebar, onFocusSearch,
}: CommandPaletteProps) {
  const isMobile = useIsMobile();

  // Close on Escape at the document level (backup for cmdk's built-in handling)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className={isMobile ? "fixed inset-0 bg-bg-primary z-[1000]" : "fixed inset-0 bg-black/50 flex items-start justify-center pt-[15vh] z-[1000]"}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.25, 1, 0.5, 1] }}
            className={isMobile
              ? "w-full h-full flex flex-col"
              : "w-full max-w-[500px] bg-bg-sidebar border border-border-subtle rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] overflow-hidden"
            }
          >
            <Command
              className="flex flex-col bg-bg-sidebar overflow-hidden flex-1"
            >
              <Command.Input
                placeholder="Search docs or type a command..."
                className="w-full bg-transparent px-4 py-3 text-sm text-text-primary outline-none border-b border-border-subtle placeholder:text-text-ghost"
                autoFocus
              />
              <Command.List className="overflow-y-auto flex-1 py-2 max-h-[50vh]">
                <Command.Empty className="px-4 py-6 text-center text-ui text-text-ghost">
                  No results found.
                </Command.Empty>

                <Command.Group heading="Documents" className="px-2">
                  {documents.map((doc) => (
                    <Command.Item
                      key={doc.id}
                      value={`${doc.title || "Untitled"} ${doc.id}`}
                      keywords={[doc.title || "Untitled"]}
                      onSelect={() => { onSelect(doc.id); onClose(); }}
                      className="flex items-center px-3 py-2 rounded-md text-ui text-text-secondary cursor-pointer data-[selected=true]:bg-bg-hover data-[selected=true]:text-text-primary"
                    >
                      {doc.title || "Untitled"}
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Separator className="h-px bg-border-subtle mx-2 my-1" />

                <Command.Group heading="Actions" className="px-2">
                  <Command.Item
                    onSelect={() => { onNewDoc(); onClose(); }}
                    className="flex items-center justify-between px-3 py-2 rounded-md text-ui text-text-secondary cursor-pointer data-[selected=true]:bg-bg-hover data-[selected=true]:text-text-primary"
                  >
                    New Document
                    <span className="text-xs text-text-ghost font-mono">Ctrl+N</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => { onToggleSidebar(); onClose(); }}
                    className="flex items-center justify-between px-3 py-2 rounded-md text-ui text-text-secondary cursor-pointer data-[selected=true]:bg-bg-hover data-[selected=true]:text-text-primary"
                  >
                    Toggle Sidebar
                    <span className="text-xs text-text-ghost font-mono">Ctrl+\</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => { onFocusSearch(); onClose(); }}
                    className="flex items-center justify-between px-3 py-2 rounded-md text-ui text-text-secondary cursor-pointer data-[selected=true]:bg-bg-hover data-[selected=true]:text-text-primary"
                  >
                    Search Notes
                    <span className="text-xs text-text-ghost font-mono">Ctrl+Shift+F</span>
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

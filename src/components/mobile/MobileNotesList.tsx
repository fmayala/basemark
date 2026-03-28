"use client";

import { useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import type { Document } from "@/hooks/useDocuments";
import type { Collection } from "@/hooks/useCollections";
import { extractText } from "@/lib/text";
import { MobileNoteRow } from "./MobileNoteRow";
import { Logo } from "@/components/ui/Logo";

interface MobileNotesListProps {
  documents: Document[];
  collections: Collection[];
  onOpenDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
}

export function MobileNotesList({
  documents,
  collections,
  onOpenDoc,
  onDeleteDoc,
}: MobileNotesListProps) {
  const collectionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of collections) {
      map.set(col.id, col.name);
    }
    return map;
  }, [collections]);

  const sortedDocs = useMemo(
    () => [...documents].sort((a, b) => b.updatedAt - a.updatedAt),
    [documents]
  );

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top bar — title + avatar */}
      <div className="sticky top-0 z-10 bg-bg-primary px-5 pt-6 pb-4 border-b border-border/20 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-title text-display text-text-primary">Basemark</span>
            <Logo size={44} className="text-text-primary" />
          </div>
          <MobileProfileButton />
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto">
        {sortedDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-1 py-16">
            <span className="text-text-ghost text-mobile-input">No notes yet</span>
            <span className="text-text-dimmed text-ui">Tap + to create one</span>
          </div>
        ) : (
          sortedDocs.map((doc) => {
            let parsed: unknown;
            try {
              parsed = doc.content ? JSON.parse(doc.content) : null;
            } catch {
              parsed = null;
            }
            const rawText = extractText(parsed as Parameters<typeof extractText>[0]);
            const preview = rawText ? rawText.slice(0, 80) : undefined;
            const collectionName = doc.collectionId
              ? collectionMap.get(doc.collectionId)
              : undefined;

            return (
              <MobileNoteRow
                key={doc.id}
                title={doc.title}
                preview={preview}
                collectionName={collectionName}
                updatedAt={doc.updatedAt}
                onClick={() => onOpenDoc(doc.id)}
                onDelete={() => onDeleteDoc(doc.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function MobileProfileButton() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!session?.user) return null;

  const { name, email, image } = session.user;

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-10 h-10 rounded-full overflow-hidden bg-bg-hover border-none cursor-pointer flex items-center justify-center shrink-0"
        aria-label="Profile"
      >
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-mobile-input text-accent font-medium">
            {(name || email || "?")[0].toUpperCase()}
          </span>
        )}
      </button>

      <AnimatePresence>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12, ease: [0.25, 1, 0.5, 1] }}
              className="absolute right-0 top-full mt-2 bg-bg-sidebar border border-border-subtle rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)] py-1.5 z-50 min-w-[200px]"
            >
              <div className="px-4 py-2">
                {name && <div className="text-sm text-text-primary truncate">{name}</div>}
                {email && <div className="text-ui text-text-ghost truncate mt-0.5">{email}</div>}
              </div>
              <div className="h-px bg-border-subtle mx-3 my-1" />
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full px-4 py-2.5 text-sm text-text-primary bg-transparent border-none cursor-pointer text-left font-inherit active:bg-bg-hover transition-colors duration-100"
              >
                Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

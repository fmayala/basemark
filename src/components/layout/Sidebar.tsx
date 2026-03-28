"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Collection } from "@/hooks/useCollections";
import type { Document } from "@/hooks/useDocuments";
import FilesView from "@/components/sidebar/FilesView";
import SearchView from "@/components/sidebar/SearchView";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  collections: Collection[];
  documents: Document[];
  activeDocId: string | null;
  onDocClick: (doc: { id: string; title: string }) => void;
  /** Increment to focus the search input */
  focusSearchSignal?: number;
  onDocRename?: (id: string, title: string) => Promise<void>;
  onDocDelete?: (id: string) => Promise<void>;
  onDocMove?: (id: string, collectionId: string | null) => Promise<void>;
  onDocReorder?: (updates: { id: string; sortOrder: number; collectionId?: string | null }[]) => Promise<void>;
  onDocUpdate?: (id: string, updates: Partial<Pick<Document, "isPublic">>) => Promise<void>;
  onCollectionCreate?: (name: string) => Promise<void>;
  onCollectionRename?: (id: string, name: string) => Promise<void>;
  onCollectionDelete?: (id: string) => Promise<void>;
  onCollectionReorder?: (updates: { id: string; sortOrder: number }[]) => Promise<void>;
}

export default function Sidebar({
  collections,
  documents,
  activeDocId,
  onDocClick,
  focusSearchSignal,
  onDocRename,
  onDocDelete,
  onDocMove,
  onDocReorder,
  onDocUpdate,
  onCollectionCreate,
  onCollectionRename,
  onCollectionDelete,
  onCollectionReorder,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSearchSignal != null) {
      inputRef.current?.focus();
    }
  }, [focusSearchSignal]);

  return (
    <div className="w-[260px] h-full bg-bg-sidebar flex flex-col overflow-hidden shrink-0">
      {/* Search — always visible at top */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <Label htmlFor="sidebar-search-input" className="sr-only">Search notes</Label>
        <Input
          id="sidebar-search-input"
          ref={inputRef}
          type="text"
          placeholder="Search notes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-ui"
        />
      </div>

      {/* Tree or search results */}
      <AnimatePresence mode="wait">
        {query.trim() ? (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex-1 overflow-hidden"
          >
            <SearchView
              onResultClick={(r) => onDocClick({ id: r.id, title: r.title })}
              externalQuery={query.trim()}
            />
          </motion.div>
        ) : (
          <motion.div
            key="files"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex-1 overflow-hidden"
          >
            <FilesView
              collections={collections}
              documents={documents}
              activeDocId={activeDocId}
              onDocClick={onDocClick}
              onDocRename={onDocRename}
              onDocDelete={onDocDelete}
              onDocMove={onDocMove}
              onDocReorder={onDocReorder}
              onDocUpdate={onDocUpdate}
              onCollectionCreate={onCollectionCreate}
              onCollectionRename={onCollectionRename}
              onCollectionDelete={onCollectionDelete}
              onCollectionReorder={onCollectionReorder}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile / sign out */}
      <UserProfile />
    </div>
  );
}

function UserProfile() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  if (!session?.user) return null;

  const { name, email, image } = session.user;

  return (
    <div className="relative px-3 py-2 border-t border-border/30 shrink-0">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex-1 justify-start gap-2.5 px-1 py-1 h-auto min-w-0"
        >
          {image ? (
            <img
              src={image}
              alt=""
              className="w-6 h-6 rounded-full shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent font-medium shrink-0">
              {(name || email || "?")[0].toUpperCase()}
            </div>
          )}
          <span className="text-xs text-text-secondary truncate">
            {name || email}
          </span>
        </Button>

        {/* Settings gear */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/settings")}
          aria-label="Settings"
          className="shrink-0 text-text-ghost hover:text-text-secondary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.25, 1, 0.5, 1] }}
            className="absolute bottom-full left-3 right-3 mb-1 bg-bg-input border border-border-subtle rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.4)] py-1 z-50"
          >
            {email && (
              <div className="px-3 py-1.5 text-xs text-text-ghost truncate">
                {email}
              </div>
            )}
            <Separator className="mx-2 my-0.5" />
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full justify-start px-3 py-1.5 h-auto text-ui text-text-primary rounded-none"
            >
              Sign out
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

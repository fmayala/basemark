"use client";

import { useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useAnimate } from "framer-motion";
import { useDocuments } from "@/hooks/useDocuments";
import type { Document } from "@/hooks/useDocuments";
import { useCollections } from "@/hooks/useCollections";
import type { Collection } from "@/hooks/useCollections";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/ui/Logo";

interface HomePageProps {
  initialDocuments?: Document[];
}

export interface CollectionRow {
  id: string | null;
  name: string;
  count: number;
  latestDoc: Document | undefined;
  latestUpdatedAt: number;
}

export function deriveCollectionRows(
  documents: Document[],
  collections: Collection[],
): CollectionRow[] {
  if (documents.length === 0) return [];

  const byCollection = new Map<string | null, Document[]>();
  for (const doc of documents) {
    const key = doc.collectionId;
    const existing = byCollection.get(key) ?? [];
    existing.push(doc);
    byCollection.set(key, existing);
  }

  const rows: CollectionRow[] = [];

  for (const col of collections) {
    const docs = byCollection.get(col.id) ?? [];
    if (docs.length === 0) continue;
    const sorted = [...docs].sort((a, b) => b.updatedAt - a.updatedAt);
    rows.push({
      id: col.id,
      name: col.name,
      count: docs.length,
      latestDoc: sorted[0],
      latestUpdatedAt: sorted[0].updatedAt,
    });
  }

  const uncategorized = byCollection.get(null) ?? [];
  if (uncategorized.length > 0) {
    const sorted = [...uncategorized].sort((a, b) => b.updatedAt - a.updatedAt);
    rows.push({
      id: null,
      name: "Uncategorized",
      count: uncategorized.length,
      latestDoc: sorted[0],
      latestUpdatedAt: sorted[0].updatedAt,
    });
  }

  return rows.sort((a, b) => b.latestUpdatedAt - a.latestUpdatedAt);
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 1, 0.5, 1] as const } },
};

export function HomePage({ initialDocuments }: HomePageProps) {
  const router = useRouter();
  const { documents: fetchedDocs, createDocument } = useDocuments();
  const { collections } = useCollections();

  const documents = fetchedDocs.length > 0 ? fetchedDocs : (initialDocuments ?? []);

  const [scope, animate] = useAnimate();
  const navigating = useRef(false);

  const [newTitle, setNewTitle] = useState("");

  async function handleCreateNote() {
    const title = newTitle.trim() || "Untitled";
    if (navigating.current) return;
    navigating.current = true;
    const [doc] = await Promise.all([
      createDocument({ title }),
      animate(scope.current, { opacity: 0, y: -6 }, { duration: 0.18, ease: [0.25, 1, 0.5, 1] }),
    ]);
    if (doc) {
      // Sync title immediately so the tab picks it up before navigation
      window.dispatchEvent(
        new CustomEvent("outline:document-sync", { detail: { id: doc.id, title } })
      );
      router.push(`/doc/${doc.id}`);
    } else {
      navigating.current = false;
      animate(scope.current, { opacity: 1, y: 0 }, { duration: 0.15 });
    }
  }

  function handleRowClick(row: CollectionRow) {
    if (!row.latestDoc) return;
    router.push(`/doc/${row.latestDoc.id}`);
  }

  const collectionRows = useMemo(
    () => deriveCollectionRows(documents, collections),
    [documents, collections],
  );

  return (
    <div className="pt-12 px-6 flex flex-col items-center">
      <motion.div
        ref={scope}
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[480px]"
      >
        {/* Title */}
        <motion.div variants={fadeUp}>
          {/* Desktop: text + logo side by side; Mobile: text + logo stacked, centered */}
          <div className="hidden md:flex items-center gap-3 mb-1">
            <h1 className="font-title text-[1.75rem] font-normal text-text-primary m-0 tracking-tight">
              Basemark
            </h1>
            <Logo size={40} className="text-text-primary" />
          </div>
          <div className="flex flex-col items-center gap-3 md:hidden mb-1">
            <h1 className="font-title text-4xl font-normal text-text-primary m-0 tracking-tight">
              Basemark
            </h1>
            <Logo size={80} className="text-text-primary" />
          </div>
        </motion.div>

        {/* Subtitle */}
        <motion.div variants={fadeUp}>
          <p className="text-sm text-text-ghost m-0 mb-6">
            What&apos;s on your mind?
          </p>
        </motion.div>

        {/* New note input */}
        <motion.div variants={fadeUp}>
          <div className="relative mb-8">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) handleCreateNote();
              }}
              placeholder="Title for a new note..."
              className="w-full bg-bg-sidebar border border-border rounded-lg px-4 py-3 text-base text-text-primary outline-none font-inherit placeholder:text-text-ghost hover:border-border-subtle focus:border-border-subtle transition-colors duration-150"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-ghost pointer-events-none">
              <kbd className="font-mono text-xs bg-bg-input px-1.5 py-0.5 rounded">Enter</kbd>
            </span>
          </div>
        </motion.div>

        {/* Collections overview */}
        {collectionRows.length > 0 && (
          <motion.div variants={fadeUp}>
            <Separator className="mb-6" />
            <div className="text-xs uppercase tracking-[0.04em] text-text-ghost mb-3">
              Collections
            </div>
            <div className="flex flex-col gap-0.5">
              {collectionRows.map((row) => (
                <button
                  type="button"
                  key={row.id ?? "__uncategorized__"}
                  onClick={() => handleRowClick(row)}
                  className="flex items-baseline justify-between w-full border-none bg-transparent px-3 py-2 -mx-3 rounded-lg cursor-pointer text-left transition-colors duration-150 hover:bg-bg-hover/50 active:bg-bg-hover/50"
                >
                  <div className="flex items-baseline gap-2.5 min-w-0">
                    <span className="text-sm text-text-secondary shrink-0">{row.name}</span>
                    {row.latestDoc && (
                      <span className="text-xs text-text-dimmed overflow-hidden text-ellipsis whitespace-nowrap">
                        {row.latestDoc.title || "Untitled"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-dimmed shrink-0 ml-3">{row.count}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

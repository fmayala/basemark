"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import type { Collection } from "@/hooks/useCollections";
import type { Document } from "@/hooks/useDocuments";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableDocRow from "./SortableDocRow";
import { Input } from "@/components/ui/input";

function InlineRenameInput({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <Input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit();
        if (e.key === "Escape") onCancel();
      }}
      onBlur={onCancel}
      className="h-auto py-[2px] text-sm"
    />
  );
}

interface CollectionTreeProps {
  collection: Collection;
  documents: Document[];
  activeDocId: string | null;
  onDocClick: (doc: Document) => void;
  onDocContextMenu?: (e: React.MouseEvent, doc: Document) => void;
  renamingDocId: string | null;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (id: string, newTitle: string) => void;
  onRenameCancel: () => void;
  onCollectionContextMenu?: (e: React.MouseEvent, collection: Collection) => void;
  renamingCollection?: boolean;
  collectionRenameValue?: string;
  onCollectionRenameChange?: (v: string) => void;
  onCollectionRenameSubmit?: () => void;
  onCollectionRenameCancel?: () => void;
  dragListeners?: Record<string, unknown>;
  dragAttributes?: Record<string, unknown>;
}

export default function CollectionTree({
  collection,
  documents,
  activeDocId,
  onDocClick,
  onDocContextMenu,
  renamingDocId,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onCollectionContextMenu,
  renamingCollection,
  collectionRenameValue,
  onCollectionRenameChange,
  onCollectionRenameSubmit,
  onCollectionRenameCancel,
  dragListeners,
  dragAttributes,
}: CollectionTreeProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      {renamingCollection ? (
        <div className="px-3 py-1">
          <InlineRenameInput
            value={collectionRenameValue ?? ""}
            onChange={onCollectionRenameChange ?? (() => {})}
            onSubmit={onCollectionRenameSubmit ?? (() => {})}
            onCancel={onCollectionRenameCancel ?? (() => {})}
          />
        </div>
      ) : (
        <button
          onClick={() => setExpanded(!expanded)}
          onContextMenu={
            onCollectionContextMenu
              ? (e) => { e.preventDefault(); onCollectionContextMenu(e, collection); }
              : undefined
          }
          {...(dragAttributes ?? {})}
          {...(dragListeners ?? {})}
          className={`flex items-center justify-between w-full bg-transparent border-none px-3 py-1 ${dragListeners ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} text-text-secondary text-xs font-inherit font-semibold tracking-[0.01em] transition-colors duration-150 text-left hover:text-text-primary`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <ChevronRight
              size={12}
              strokeWidth={2}
              className={`shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : "rotate-0"}`}
            />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
              {collection.name}
            </span>
          </div>
          <span className="text-[11px] text-text-dimmed font-normal shrink-0 ml-1">
            {documents.length}
          </span>
        </button>
      )}
      <div className={`tree-expand ${expanded ? "" : "collapsed"}`}>
        <div className="pl-1 ml-2 border-l border-border/50">
          <SortableContext
            items={documents.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            {documents.map((doc) => (
              <SortableDocRow
                key={doc.id}
                doc={doc}
                isActive={activeDocId === doc.id}
                isRenaming={renamingDocId === doc.id}
                dim={true}
                renameValue={renameValue}
                onDocClick={onDocClick}
                onContextMenu={onDocContextMenu ?? (() => {})}
                onRenameChange={onRenameChange}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
              />
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}

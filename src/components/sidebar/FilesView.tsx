"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Plus } from "lucide-react";
import type { Collection } from "@/hooks/useCollections";
import type { Document } from "@/hooks/useDocuments";
import SortableCollectionTree from "./SortableCollectionTree";
import ContextMenu from "@/components/ui/ContextMenu";
import ShareDialog from "@/components/share/ShareDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import MoveToCollectionDialog from "./MoveToCollectionDialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { computeSortUpdates } from "@/lib/sort-order";
import SortableDocRow from "./SortableDocRow";

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

interface FilesViewProps {
  collections: Collection[];
  documents: Document[];
  activeDocId: string | null;
  onDocClick: (doc: Document) => void;
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

interface ContextMenuState {
  x: number;
  y: number;
  doc: Document;
}

export default function FilesView({
  collections,
  documents,
  activeDocId,
  onDocClick,
  onDocRename,
  onDocDelete,
  onDocMove,
  onDocReorder,
  onDocUpdate,
  onCollectionCreate,
  onCollectionRename,
  onCollectionDelete,
  onCollectionReorder,
}: FilesViewProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [moveTarget, setMoveTarget] = useState<Document | null>(null);
  const [collectionContextMenu, setCollectionContextMenu] = useState<{
    x: number;
    y: number;
    collection: Collection;
  } | null>(null);
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [collectionRenameValue, setCollectionRenameValue] = useState("");
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<Collection | null>(null);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [activeDragDoc, setActiveDragDoc] = useState<Document | null>(null);
  const [activeDragCollection, setActiveDragCollection] = useState<Collection | null>(null);

  const { grouped, uncategorized } = useMemo(() => {
    const grouped = new Map<string, Document[]>();
    const uncategorized: Document[] = [];
    for (const doc of documents) {
      if (doc.collectionId) {
        const existing = grouped.get(doc.collectionId) ?? [];
        existing.push(doc);
        grouped.set(doc.collectionId, existing);
      } else {
        uncategorized.push(doc);
      }
    }
    return { grouped, uncategorized };
  }, [documents]);

  const collectionIds = useMemo(() => collections.map((c) => c.id), [collections]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, doc: Document) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, doc });
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleRenameSubmit = useCallback(
    async (id: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (trimmed && onDocRename) {
        await onDocRename(id, trimmed);
      }
      setRenamingDocId(null);
    },
    [onDocRename],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingDocId(null);
  }, []);

  const handleCollectionContextMenu = useCallback(
    (e: React.MouseEvent, collection: Collection) => {
      e.preventDefault();
      e.stopPropagation();
      setCollectionContextMenu({ x: e.clientX, y: e.clientY, collection });
    },
    [],
  );

  const handleCollectionRenameSubmit = useCallback(
    async (id: string) => {
      const trimmed = collectionRenameValue.trim();
      if (trimmed && onCollectionRename) {
        await onCollectionRename(id, trimmed);
      }
      setRenamingCollectionId(null);
    },
    [collectionRenameValue, onCollectionRename],
  );

  const handleCollectionCreate = useCallback(async () => {
    const trimmed = newCollectionName.trim();
    if (trimmed && onCollectionCreate) {
      await onCollectionCreate(trimmed);
    }
    setCreatingCollection(false);
    setNewCollectionName("");
  }, [newCollectionName, onCollectionCreate]);

  const buildMenuItems = useCallback(
    (doc: Document) => [
      {
        label: "Rename",
        onClick: () => {
          setRenamingDocId(doc.id);
          setRenameValue(doc.title || "Untitled");
        },
      },
      {
        label: "Move to collection...",
        onClick: () => {
          setMoveTarget(doc);
        },
      },
      {
        label: "Share",
        onClick: () => {
          setShareDocId(doc.id);
        },
      },
      {
        label: "Delete",
        danger: true,
        onClick: () => {
          setDeleteTarget(doc);
        },
      },
    ],
    [], // was [onDocDelete] — onDocDelete is not used inside this callback
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const doc = documents.find((d) => d.id === event.active.id);
      if (doc) {
        setActiveDragDoc(doc);
        return;
      }
      const col = collections.find((c) => c.id === event.active.id);
      if (col) setActiveDragCollection(col);
    },
    [documents, collections],
  );

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Hook point: reserved for live visual feedback between containers in future iterations.
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragDoc(null);
      setActiveDragCollection(null);
      if (!over || active.id === over.id) return;

      // Collection reorder
      if (collectionIds.includes(String(active.id))) {
        if (!collectionIds.includes(String(over.id))) return;
        const fromIndex = collections.findIndex((c) => c.id === active.id);
        const toIndex = collections.findIndex((c) => c.id === over.id);
        if (fromIndex === -1 || toIndex === -1) return;
        const activeCollection = collections[fromIndex];
        const destinationWithoutActive = collections.filter((c) => c.id !== active.id);
        const updates = computeSortUpdates(destinationWithoutActive, activeCollection, toIndex);
        if (onCollectionReorder) {
          await onCollectionReorder(updates);
        }
        return;
      }

      const allGroups: { collectionId: string | null; docs: Document[] }[] = [
        ...collections.map((col) => ({
          collectionId: col.id as string | null,
          docs: grouped.get(col.id) ?? [],
        })),
        { collectionId: null, docs: uncategorized },
      ];

      // Find source group (where the dragged doc lives)
      const sourceGroup = allGroups.find((g) =>
        g.docs.some((d) => d.id === active.id),
      );
      if (!sourceGroup) return;
      const activeDoc = sourceGroup.docs.find((d) => d.id === active.id)!;

      // Determine destination group and insert index:
      // Case A: over.id is a collection id → drop at end of that collection
      // Case B: over.id is a doc id → find which group owns that doc
      let destGroup: { collectionId: string | null; docs: Document[] } | undefined;
      let overIndex: number;

      if (collectionIds.includes(String(over.id))) {
        // Case A: dropped onto a collection header.
        // Collection IDs are registered as sortable items in Task 5's outer SortableContext,
        // making over.id equal to a collection ID when dragging docs over collection headers.
        destGroup = allGroups.find((g) => g.collectionId === over.id);
        if (!destGroup) return;
        overIndex = destGroup.docs.length; // append at end
      } else {
        // Case B: dropped onto a doc
        destGroup = allGroups.find((g) => g.docs.some((d) => d.id === over.id));
        if (!destGroup) return;
        overIndex = destGroup.docs.findIndex((d) => d.id === over.id);
        if (overIndex === -1) return;
      }

      const isCrossCollection = destGroup.collectionId !== sourceGroup.collectionId;
      const destinationWithoutActive = destGroup.docs.filter((d) => d.id !== active.id);
      const updates = computeSortUpdates(destinationWithoutActive, activeDoc, overIndex);

      const finalUpdates = isCrossCollection
        ? updates.map((u) => ({ ...u, collectionId: destGroup!.collectionId }))
        : updates;

      if (onDocReorder) {
        await onDocReorder(finalUpdates);
      }
    },
    [collections, collectionIds, grouped, uncategorized, onDocReorder, onCollectionReorder],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
    <ScrollArea className="flex-1 pt-2">
      {/* Collections section header */}
      <div className="flex items-center justify-between px-3 py-1 mb-0.5">
        <span className="text-xs text-text-ghost uppercase tracking-wider font-medium">Collections</span>
        <button
          type="button"
          onClick={() => setCreatingCollection(true)}
          className="rounded pl-0.5 text-text-ghost hover:text-text-primary hover:bg-bg-hover bg-transparent border-none cursor-pointer transition-colors duration-150"
          aria-label="New collection"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      </div>

      {creatingCollection && (
        <div className="px-3 mb-2">
          <InlineRenameInput
            value={newCollectionName}
            onChange={setNewCollectionName}
            onSubmit={handleCollectionCreate}
            onCancel={() => { setCreatingCollection(false); setNewCollectionName(""); }}
          />
        </div>
      )}

      <SortableContext items={collectionIds} strategy={verticalListSortingStrategy}>
        {collections.map((col) => (
          <div key={col.id} className="mb-4">
            <SortableCollectionTree
              collection={col}
              documents={grouped.get(col.id) ?? []}
              activeDocId={activeDocId}
              onDocClick={onDocClick}
              onDocContextMenu={handleContextMenu}
              renamingDocId={renamingDocId}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={handleRenameCancel}
              onCollectionContextMenu={handleCollectionContextMenu}
              renamingCollection={renamingCollectionId === col.id}
              collectionRenameValue={collectionRenameValue}
              onCollectionRenameChange={setCollectionRenameValue}
              onCollectionRenameSubmit={() => handleCollectionRenameSubmit(col.id)}
              onCollectionRenameCancel={() => setRenamingCollectionId(null)}
            />
          </div>
        ))}
      </SortableContext>

      {uncategorized.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs font-semibold tracking-[0.01em] text-text-secondary">
              Uncategorized
            </span>
            <span className="text-[11px] text-text-dimmed font-normal">
              {uncategorized.length}
            </span>
          </div>
          <div className="pl-1 ml-2 border-l border-border/50">
          <SortableContext
            items={uncategorized.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            {uncategorized.map((doc) => (
              <SortableDocRow
                key={doc.id}
                doc={doc}
                isActive={activeDocId === doc.id}
                isRenaming={renamingDocId === doc.id}
                renameValue={renameValue}
                onDocClick={onDocClick}
                onContextMenu={handleContextMenu}
                onRenameChange={setRenameValue}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
              />
            ))}
          </SortableContext>
          </div>
        </div>
      )}

      {/* New collection inline input moved to section header */}

      {collections.length === 0 && uncategorized.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-text-ghost mb-2">No documents yet</p>
          <p className="text-ui md:text-xs text-text-dimmed">Press Ctrl+N to create one</p>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={buildMenuItems(contextMenu.doc)}
        />
      )}

      {collectionContextMenu && (
        <ContextMenu
          x={collectionContextMenu.x}
          y={collectionContextMenu.y}
          onClose={() => setCollectionContextMenu(null)}
          items={[
            {
              label: "Rename",
              onClick: () => {
                setRenamingCollectionId(collectionContextMenu.collection.id);
                setCollectionRenameValue(collectionContextMenu.collection.name);
              },
            },
            {
              label: "Delete",
              danger: true,
              onClick: () => {
                setDeleteCollectionTarget(collectionContextMenu.collection);
              },
            },
          ]}
        />
      )}

      {shareDocId && (
        <ShareDialog
          documentId={shareDocId}
          isPublic={!!documents.find((d) => d.id === shareDocId)?.isPublic}
          onTogglePublic={async (pub) => {
            if (onDocUpdate) await onDocUpdate(shareDocId, { isPublic: pub });
          }}
          open={true}
          onClose={() => setShareDocId(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete document"
          message={`Delete "${deleteTarget.title || "Untitled"}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            if (onDocDelete) {
              await onDocDelete(deleteTarget.id);
            } else {
              await fetch(`/api/documents/${deleteTarget.id}`, { method: "DELETE" });
            }
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteCollectionTarget && (
        <ConfirmDialog
          open={true}
          title="Delete collection"
          message={`Delete "${deleteCollectionTarget.name}"? Notes in this collection will be moved to Uncategorized.`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            if (onCollectionDelete) {
              await onCollectionDelete(deleteCollectionTarget.id);
            }
            setDeleteCollectionTarget(null);
          }}
          onCancel={() => setDeleteCollectionTarget(null)}
        />
      )}

      {moveTarget && (
        <MoveToCollectionDialog
          open={true}
          collections={collections}
          currentCollectionId={moveTarget.collectionId}
          onMove={async (collectionId) => {
            if (onDocMove) {
              await onDocMove(moveTarget.id, collectionId);
            }
            setMoveTarget(null);
          }}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </ScrollArea>
      <DragOverlay dropAnimation={null}>
        {activeDragDoc ? (
          <div className="flex items-center rounded px-3 py-[2px] text-ui text-text-primary bg-bg-hover border border-border-subtle shadow-lg opacity-90 cursor-grabbing">
            {activeDragDoc.title || "Untitled"}
          </div>
        ) : activeDragCollection ? (
          <div className="flex items-center rounded px-3 py-1 text-ui font-semibold text-text-secondary bg-bg-hover border border-border-subtle shadow-lg opacity-90 cursor-grabbing">
            {activeDragCollection.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CollectionTree from "./CollectionTree";
import type { Collection } from "@/hooks/useCollections";
import type { Document } from "@/hooks/useDocuments";

interface SortableCollectionTreeProps {
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
}

export default function SortableCollectionTree(props: SortableCollectionTreeProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.collection.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CollectionTree
        {...props}
        dragListeners={listeners as Record<string, unknown>}
        dragAttributes={attributes as unknown as Record<string, unknown>}
      />
    </div>
  );
}

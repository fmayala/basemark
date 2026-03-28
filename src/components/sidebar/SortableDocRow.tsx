"use client";

import { useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import type { Document } from "@/hooks/useDocuments";
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

interface SortableDocRowProps {
  doc: Document;
  isActive: boolean;
  isRenaming: boolean;
  dim?: boolean;
  renameValue: string;
  onDocClick: (doc: Document) => void;
  onContextMenu: (e: React.MouseEvent, doc: Document) => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (id: string, newTitle: string) => void;
  onRenameCancel: () => void;
}

export default function SortableDocRow({
  doc,
  isActive,
  isRenaming,
  dim = false,
  renameValue,
  onDocClick,
  onContextMenu,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
}: SortableDocRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: doc.id });

  if (isRenaming) {
    return (
      <div ref={setNodeRef} className="mx-1.5 py-[1px]">
        <InlineRenameInput
          value={renameValue}
          onChange={onRenameChange}
          onSubmit={() => onRenameSubmit(doc.id, renameValue)}
          onCancel={onRenameCancel}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="mx-1.5 mb-0.5"
      style={{
        opacity: isDragging ? 0.35 : 1,
        transition: "opacity 0.15s ease",
        cursor: isDragging ? "grabbing" : "pointer",
        // No transform/translate — items stay in place (ghost drag, no displacement)
      }}
    >
      <button
        type="button"
        onClick={() => onDocClick(doc)}
        onContextMenu={(e) => onContextMenu(e, doc)}
        className={`w-full min-w-0 border-none rounded-md px-2.5 py-1.5 cursor-pointer text-sm font-inherit text-left transition-colors duration-150 flex items-center gap-1.5
          ${
            isActive
              ? "bg-bg-active text-text-primary"
              : `bg-transparent ${dim ? "text-text-faint hover:text-text-primary" : "text-text-primary"} hover:bg-bg-hover`
          }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-50"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="truncate">{doc.title || "Untitled"}</span>
      </button>
    </div>
  );
}

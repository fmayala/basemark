"use client";

import { useEffect, useRef, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Collection } from "@/hooks/useCollections";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface MoveToCollectionDialogProps {
  open: boolean;
  collections: Collection[];
  currentCollectionId: string | null;
  onMove: (collectionId: string | null) => void;
  onClose: () => void;
}

export default function MoveToCollectionDialog({
  open,
  collections,
  currentCollectionId,
  onMove,
  onClose,
}: MoveToCollectionDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="bg-bg-sidebar border border-border-subtle rounded-xl p-4 w-[320px] max-w-[90vw] shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id={titleId} className="m-0 text-sm font-semibold text-text-primary">
                Move to collection
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close"
                className="text-text-faint hover:text-text-primary"
              >
                ×
              </Button>
            </div>
            <div className="flex flex-col gap-0.5">
              {collections.map((col) => (
                <button
                  type="button"
                  key={col.id}
                  onClick={() => { onMove(col.id); onClose(); }}
                  className={`w-full text-left border-none rounded-md px-3 py-2 text-ui cursor-pointer font-inherit transition-colors duration-150
                    ${currentCollectionId === col.id
                      ? "bg-bg-hover text-text-primary"
                      : "bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    }`}
                >
                  {col.name}
                  {currentCollectionId === col.id && (
                    <span className="ml-2 text-xs text-text-dimmed">current</span>
                  )}
                </button>
              ))}
              <Separator className="my-1" />
              <button
                type="button"
                onClick={() => { onMove(null); onClose(); }}
                className={`w-full text-left border-none rounded-md px-3 py-2 text-ui cursor-pointer font-inherit transition-colors duration-150
                  ${currentCollectionId === null
                    ? "bg-bg-hover text-text-primary"
                    : "bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
              >
                Uncategorized
                {currentCollectionId === null && (
                  <span className="ml-2 text-xs text-text-dimmed">current</span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

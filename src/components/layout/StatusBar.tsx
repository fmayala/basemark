"use client";

import { useState, useEffect } from "react";
import { timeAgo } from "@/lib/format";

interface StatusBarProps {
  wordCount: number;
  charCount: number;
  updatedAt?: number;
  hasShareLink?: boolean;
}

export default function StatusBar({ wordCount, charCount, updatedAt, hasShareLink }: StatusBarProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    function handleSaveStatus(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.status === "saving") {
        setSaveState("saving");
        setSaveError(null);
      } else if (detail?.status === "saved") {
        setSaveState("idle");
        setSaveError(null);
      } else if (detail?.status === "error") {
        setSaveState("error");
        setSaveError(detail?.message || "Save failed");
      }
    }
    window.addEventListener("basemark:save-status", handleSaveStatus);
    return () => window.removeEventListener("basemark:save-status", handleSaveStatus);
  }, []);

  return (
    <div className="group flex justify-end items-center gap-3 px-4 py-1 text-text-dimmed text-xs font-body select-none">
      {saveState === "saving" && (
        <span className="text-text-ghost" aria-live="polite">Saving...</span>
      )}
      {saveState === "error" && (
        <span className="text-danger" role="alert">{saveError}</span>
      )}
      {updatedAt && saveState === "idle" && <span>Edited {timeAgo(updatedAt)}</span>}
      {hasShareLink && <span className="text-accent">Shared</span>}
      <span>{wordCount} words</span>
      <span>{charCount} characters</span>
      <span className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 text-text-ghost font-mono">
        Ctrl+K
      </span>
    </div>
  );
}

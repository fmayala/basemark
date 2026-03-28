"use client";

import { useEffect } from "react";

type ShortcutMap = Record<string, () => void>;

/**
 * Builds a normalized key string from a KeyboardEvent.
 * Modifiers: ctrl (or meta on Mac), shift, alt — always lower-case.
 * Key:  e.key is lower-cased for regular keys, kept as-is for special keys
 *       like "k", "n", "\", "f", etc.
 *
 * Examples:
 *   Ctrl+K          -> "ctrl+k"
 *   Ctrl+Shift+F    -> "ctrl+shift+f"
 *   Ctrl+\          -> "ctrl+\"
 */
function buildKeyString(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");

  // Normalise the key itself
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  parts.push(key);

  return parts.join("+");
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const keyStr = buildKeyString(e);
      const handler = shortcuts[keyStr];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // We intentionally omit `shortcuts` from the dep array — callers should
    // memoise the map themselves (or accept a re-attach on every render which
    // is safe).  Passing a stable ref would be over-engineering for this app.
  }, [shortcuts]);
}

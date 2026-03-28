import type { JSONContent } from "@tiptap/core";

function isTiptapDoc(value: unknown): value is JSONContent {
  if (!value || typeof value !== "object") return false;
  const maybeDoc = value as { type?: unknown; content?: unknown };
  return maybeDoc.type === "doc" && Array.isArray(maybeDoc.content);
}

export function parseEditorContent(content: string): string | JSONContent {
  const trimmed = content.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isTiptapDoc(parsed)) return parsed;
  } catch {
    // Fall back to raw text content.
  }

  return content;
}

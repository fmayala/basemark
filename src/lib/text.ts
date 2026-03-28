interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
  attrs?: Record<string, unknown>;
}

/**
 * Recursively extracts plain text from a Tiptap JSON document.
 * Handles all block types: paragraph, heading, codeBlock, table,
 * taskItem, callout, blockquote, listItem, etc.
 */
export function extractText(node: TiptapNode | null | undefined): string {
  if (!node) return "";

  // Leaf text node
  if (node.text) return node.text;

  // Recurse into children
  if (node.content && Array.isArray(node.content)) {
    return node.content
      .map((child) => extractText(child))
      .filter((text) => text.length > 0)
      .join(" ");
  }

  return "";
}

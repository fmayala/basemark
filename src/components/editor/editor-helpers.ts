import type { JSONContent } from "@tiptap/core";

export function buildDocLinkContent(id: string, title: string): JSONContent {
  return {
    type: "text",
    text: title || "Untitled",
    marks: [
      {
        type: "link",
        attrs: {
          href: `/doc/${id}`,
        },
      },
    ],
  };
}

export function nextMenuIndex(
  currentIndex: number,
  direction: "up" | "down",
  itemCount: number,
): number {
  if (itemCount <= 0) return 0;

  if (direction === "up") {
    return (currentIndex - 1 + itemCount) % itemCount;
  }

  return (currentIndex + 1) % itemCount;
}

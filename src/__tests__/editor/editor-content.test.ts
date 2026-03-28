import { describe, expect, it } from "vitest";
import { parseEditorContent } from "@/components/editor/editor-content";

describe("parseEditorContent", () => {
  it("returns structured JSON only for valid tiptap doc objects", () => {
    const raw = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    });

    const parsed = parseEditorContent(raw);

    expect(typeof parsed).toBe("object");
    expect(parsed).toMatchObject({ type: "doc" });
  });

  it("falls back to raw text when parsed JSON is not a tiptap doc", () => {
    const raw = JSON.stringify({ foo: "bar" });
    expect(parseEditorContent(raw)).toBe(raw);
  });

  it("returns empty string for whitespace-only content", () => {
    expect(parseEditorContent("   ")).toBe("");
  });
});

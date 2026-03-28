import { describe, it, expect } from "vitest";
import { extractText } from "@/lib/text";

describe("extractText", () => {
  it("returns empty string for null/undefined", () => {
    expect(extractText(null)).toBe("");
    expect(extractText(undefined)).toBe("");
  });

  it("extracts text from a simple paragraph", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(extractText(doc)).toContain("Hello world");
  });

  it("extracts text from nested content (headings, paragraphs)", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body text" }],
        },
      ],
    };
    const result = extractText(doc);
    expect(result).toContain("Title");
    expect(result).toContain("Body text");
  });

  it("extracts text from code blocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "js" },
          content: [{ type: "text", text: "const x = 1;" }],
        },
      ],
    };
    expect(extractText(doc)).toContain("const x = 1;");
  });

  it("extracts text from task items", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Buy milk" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractText(doc)).toContain("Buy milk");
  });

  it("extracts text from tables", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Cell A" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Cell B" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = extractText(doc);
    expect(result).toContain("Cell A");
    expect(result).toContain("Cell B");
  });

  it("extracts text from callouts", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { type: "info" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Important note" }],
            },
          ],
        },
      ],
    };
    expect(extractText(doc)).toContain("Important note");
  });

  it("extracts text from blockquotes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quoted text" }],
            },
          ],
        },
      ],
    };
    expect(extractText(doc)).toContain("Quoted text");
  });

  it("returns empty string for empty doc", () => {
    expect(extractText({ type: "doc", content: [] })).toBe("");
    expect(extractText({})).toBe("");
  });
});

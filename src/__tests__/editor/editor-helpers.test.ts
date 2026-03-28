import { describe, expect, it } from "vitest";
import {
  buildDocLinkContent,
  nextMenuIndex,
} from "@/components/editor/editor-helpers";

describe("buildDocLinkContent", () => {
  it("builds a structured link node without HTML interpolation", () => {
    const content = buildDocLinkContent("doc-123", "<img src=x onerror=alert(1)>");

    expect(content).toEqual({
      type: "text",
      text: "<img src=x onerror=alert(1)>",
      marks: [
        {
          type: "link",
          attrs: { href: "/doc/doc-123" },
        },
      ],
    });
  });
});

describe("nextMenuIndex", () => {
  it("returns 0 when there are no items", () => {
    expect(nextMenuIndex(0, "down", 0)).toBe(0);
    expect(nextMenuIndex(0, "up", 0)).toBe(0);
  });

  it("wraps correctly when items exist", () => {
    expect(nextMenuIndex(0, "up", 3)).toBe(2);
    expect(nextMenuIndex(2, "down", 3)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { deriveMobileScreen } from "@/components/mobile/mobile-route-state";

describe("deriveMobileScreen", () => {
  it("derives editor for /doc/:id", () => {
    expect(deriveMobileScreen("/doc/abc", null)).toEqual({
      screen: "editor",
      activeDocId: "abc",
    });
  });

  it("derives search when view=search", () => {
    expect(deriveMobileScreen("/", "search").screen).toBe("search");
  });

  it("does not derive editor for empty /doc/ id", () => {
    expect(deriveMobileScreen("/doc/", null)).toEqual({
      screen: "list",
      activeDocId: null,
    });
  });

  it("prioritizes search view on doc routes", () => {
    expect(deriveMobileScreen("/doc/abc", "search").screen).toBe("search");
  });
});

import { describe, it, expect } from "vitest";
import { timeAgo } from "@/lib/format";

describe("timeAgo", () => {
  it("returns 'just now' for timestamps within the last minute", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now)).toBe("just now");
    expect(timeAgo(now - 30)).toBe("just now");
  });

  it("returns minutes for timestamps within the last hour", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 120)).toBe("2 min ago");
    expect(timeAgo(now - 3000)).toBe("50 min ago");
  });

  it("returns hours for timestamps within the last day", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 7200)).toBe("2h ago");
    expect(timeAgo(now - 43200)).toBe("12h ago");
  });

  it("returns days for older timestamps", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 86400)).toBe("1d ago");
    expect(timeAgo(now - 259200)).toBe("3d ago");
  });
});

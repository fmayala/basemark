import { describe, expect, it } from "vitest";
import { mcpCreateDocInputSchema, mcpShareInputSchema } from "@/lib/mcp-constraints";

describe("mcp constraints", () => {
  it("rejects oversized content", () => {
    const result = mcpCreateDocInputSchema.safeParse({
      title: "ok",
      content: "x".repeat(500_001),
    });
    expect(result.success).toBe(false);
  });

  it("normalizes invite email", () => {
    const result = mcpShareInputSchema.safeParse({ id: "doc-1", inviteEmail: " A@B.COM " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inviteEmail).toBe("a@b.com");
    }
  });
});

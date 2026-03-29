import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

type ToolDefinition = {
  inputSchema?: Record<string, z.ZodTypeAny>;
};

const registeredTools = vi.hoisted(() => new Map<string, ToolDefinition>());

vi.mock("mcp-handler", () => ({
  createMcpHandler: (registerTools: (server: { registerTool: (name: string, config: ToolDefinition) => void }) => void) => {
    registerTools({
      registerTool: (name, config) => {
        registeredTools.set(name, config);
      },
    });
    return vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  },
}));

vi.mock("@/domain/services/tokens-service", () => ({
  createTokensService: () => ({
    validateBearer: vi.fn(),
  }),
}));

await import("@/app/api/mcp/[transport]/route");

function getToolInputSchema(toolName: string) {
  const tool = registeredTools.get(toolName);
  if (!tool?.inputSchema) {
    throw new Error(`Missing input schema for ${toolName}`);
  }

  return z.object(tool.inputSchema);
}

describe("MCP route input validation", () => {
  it("enforces create_doc content size limit", () => {
    const schema = getToolInputSchema("create_doc");
    const result = schema.safeParse({
      title: "ok",
      content: "x".repeat(500_001),
    });

    expect(result.success).toBe(false);
  });

  it("enforces create_collection name constraints", () => {
    const schema = getToolInputSchema("create_collection");
    const result = schema.safeParse({ name: "" });

    expect(result.success).toBe(false);
  });

  it("normalizes share_doc inviteEmail", () => {
    const schema = getToolInputSchema("share_doc");
    const result = schema.safeParse({
      id: "doc-1",
      inviteEmail: " A@B.COM ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inviteEmail).toBe("a@b.com");
    }
  });
});

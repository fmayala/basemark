import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const validateBearerMock = vi.hoisted(() => vi.fn());

vi.mock("mcp-handler", () => ({
  createMcpHandler: () => vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
}));

vi.mock("@/domain/services/tokens-service", () => ({
  createTokensService: () => ({
    validateBearer: validateBearerMock,
  }),
}));

const route = await import("@/app/api/mcp/[transport]/route");

describe("MCP auth middleware", () => {
  beforeEach(() => {
    validateBearerMock.mockReset();
  });

  it("accepts bearer token when required scope is present", async () => {
    validateBearerMock.mockResolvedValue({ status: "ok", token: { id: "tok_1" } });

    const req = new NextRequest("http://localhost:3000/api/mcp/http", {
      headers: { Authorization: "Bearer bm_allowed" },
    });

    const res = await route.GET(req);

    expect(res.status).toBe(200);
    expect(validateBearerMock).toHaveBeenCalledWith("bm_allowed", ["mcp:invoke"]);
  });

  it("accepts case-insensitive bearer scheme", async () => {
    validateBearerMock.mockResolvedValue({ status: "ok", token: { id: "tok_1" } });

    const req = new NextRequest("http://localhost:3000/api/mcp/http", {
      headers: { Authorization: "bEaReR bm_allowed" },
    });

    const res = await route.GET(req);

    expect(res.status).toBe(200);
    expect(validateBearerMock).toHaveBeenCalledWith("bm_allowed", ["mcp:invoke"]);
  });

  it("denies bearer token that lacks required scope", async () => {
    validateBearerMock.mockResolvedValue({ status: "scope_denied" });

    const req = new NextRequest("http://localhost:3000/api/mcp/http", {
      headers: { Authorization: "Bearer bm_missing_scope" },
    });

    const res = await route.GET(req);

    expect(res.status).toBe(403);
  });
});

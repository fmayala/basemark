import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { hashToken } from "@/domain/repos/tokens-repo";

const requireAuthMock = vi.hoisted(() => vi.fn());
const validateBodyMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-helpers", () => ({
  requireAuth: requireAuthMock,
  validateBody: validateBodyMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: insertMock,
    select: selectMock,
    delete: deleteMock,
  },
  dbReady: Promise.resolve(),
}));

const tokensRoute = await import("@/app/api/tokens/route");
const tokenByIdRoute = await import("@/app/api/tokens/[id]/route");

describe("token routes", () => {
  const insertValuesMock = vi.fn();
  const selectFromMock = vi.fn();
  const deleteWhereMock = vi.fn();
  const deleteReturningMock = vi.fn();

  beforeEach(() => {
    requireAuthMock.mockReset();
    validateBodyMock.mockReset();
    insertMock.mockReset();
    selectMock.mockReset();
    deleteMock.mockReset();
    insertValuesMock.mockReset();
    selectFromMock.mockReset();
    deleteWhereMock.mockReset();
    deleteReturningMock.mockReset();

    requireAuthMock.mockResolvedValue(null);
    validateBodyMock.mockResolvedValue([{ name: "CI token" }, null]);
    insertValuesMock.mockResolvedValue(undefined);
    selectFromMock.mockResolvedValue([]);
    deleteReturningMock.mockResolvedValue([{ id: "tok_1" }]);

    insertMock.mockReturnValue({ values: insertValuesMock });
    selectMock.mockReturnValue({ from: selectFromMock });
    deleteWhereMock.mockReturnValue({ returning: deleteReturningMock });
    deleteMock.mockReturnValue({ where: deleteWhereMock });
  });

  it("POST and GET use owner-session auth boundary", async () => {
    await tokensRoute.POST(new NextRequest("http://localhost:3000/api/tokens", { method: "POST" }));
    await tokensRoute.GET(new NextRequest("http://localhost:3000/api/tokens"));

    expect(requireAuthMock).toHaveBeenNthCalledWith(1, expect.any(NextRequest), {
      allowBearer: false,
    });
    expect(requireAuthMock).toHaveBeenNthCalledWith(2, expect.any(NextRequest), {
      allowBearer: false,
    });
  });

  it("DELETE uses owner-session auth boundary", async () => {
    await tokenByIdRoute.DELETE(
      new NextRequest("http://localhost:3000/api/tokens/tok_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "tok_1" }) },
    );

    expect(requireAuthMock).toHaveBeenCalledWith(expect.any(NextRequest), {
      allowBearer: false,
    });
  });

  it("POST stores token hash while returning raw bearer token", async () => {
    const res = await tokensRoute.POST(
      new NextRequest("http://localhost:3000/api/tokens", {
        method: "POST",
      }),
    );

    const data = await res.json();
    const insertedRow = insertValuesMock.mock.calls[0]?.[0];

    expect(res.status).toBe(201);
    expect(data.token).toMatch(/^bm_/);
    expect(insertedRow.tokenHash).toBe(hashToken(data.token));
  });

  it("POST persists safe default scope when omitted", async () => {
    validateBodyMock.mockResolvedValue([{ name: "Scoped token" }, null]);

    await tokensRoute.POST(new NextRequest("http://localhost:3000/api/tokens", { method: "POST" }));
    const insertedRow = insertValuesMock.mock.calls[0]?.[0];

    expect(insertedRow.scope).toBe("documents:read");
  });

  it("POST persists requested scopes when valid", async () => {
    validateBodyMock.mockResolvedValue([
      { name: "Scoped token", scopes: ["documents:read", "mcp:invoke"] },
      null,
    ]);

    await tokensRoute.POST(new NextRequest("http://localhost:3000/api/tokens", { method: "POST" }));
    const insertedRow = insertValuesMock.mock.calls[0]?.[0];

    expect(insertedRow.scope).toBe("documents:read mcp:invoke");
  });

  it("POST rejects requested scope outside allow-list", async () => {
    const badResponse = new Response(JSON.stringify({ error: "Invalid scope" }), { status: 400 });
    validateBodyMock.mockResolvedValue([null, badResponse]);

    const res = await tokensRoute.POST(new NextRequest("http://localhost:3000/api/tokens", { method: "POST" }));

    expect(res.status).toBe(400);
    expect(insertValuesMock).not.toHaveBeenCalled();
  });
});

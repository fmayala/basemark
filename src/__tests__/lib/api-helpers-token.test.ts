import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
const isOwnerEmailMock = vi.hoisted(() => vi.fn());
const validateBearerMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/authz", () => ({
  isOwnerEmail: isOwnerEmailMock,
}));

vi.mock("@/domain/services/tokens-service", () => ({
  createTokensService: () => ({
    validateBearer: validateBearerMock,
  }),
}));

const { isApiAuthenticated, requireAuth } = await import("@/lib/api-helpers");

describe("api helpers bearer token integration", () => {
  beforeEach(() => {
    authMock.mockReset();
    isOwnerEmailMock.mockReset();
    validateBearerMock.mockReset();
  });

  it("isApiAuthenticated returns true when bearer token is valid", async () => {
    validateBearerMock.mockResolvedValue({ status: "ok", token: { id: "tok_1" } });

    const req = new NextRequest("http://localhost:3000/api/documents", {
      headers: { Authorization: "Bearer bm_valid" },
    });

    await expect(isApiAuthenticated(req)).resolves.toBe(true);
    expect(validateBearerMock).toHaveBeenCalledWith("bm_valid", []);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("isApiAuthenticated accepts case-insensitive bearer scheme", async () => {
    validateBearerMock.mockResolvedValue({ status: "ok", token: { id: "tok_1" } });

    const req = new NextRequest("http://localhost:3000/api/documents", {
      headers: { Authorization: "bEaReR bm_valid" },
    });

    await expect(isApiAuthenticated(req)).resolves.toBe(true);
    expect(validateBearerMock).toHaveBeenCalledWith("bm_valid", []);
  });

  it("requireAuth ignores bearer token when allowBearer is false", async () => {
    validateBearerMock.mockResolvedValue({ status: "ok", token: { id: "tok_1" } });
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/tokens", {
      headers: { Authorization: "Bearer bm_valid" },
    });

    const res = await requireAuth(req, { allowBearer: false });

    expect(res?.status).toBe(401);
    expect(validateBearerMock).not.toHaveBeenCalled();
  });

  it("requireAuth ignores bearer token by default", async () => {
    validateBearerMock.mockResolvedValue({ status: "ok", token: { id: "tok_1" } });
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/documents", {
      headers: { Authorization: "Bearer bm_valid" },
    });

    const res = await requireAuth(req);

    expect(res?.status).toBe(401);
    expect(validateBearerMock).not.toHaveBeenCalled();
  });

  it("requireAuth returns 403 when bearer token is scope denied", async () => {
    validateBearerMock.mockResolvedValue({ status: "scope_denied" });
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/mcp/http", {
      headers: { Authorization: "Bearer bm_valid" },
    });

    const res = await requireAuth(req, { requiredScopes: ["mcp:invoke"] });

    expect(res?.status).toBe(403);
    expect(authMock).not.toHaveBeenCalled();
  });
});

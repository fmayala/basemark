import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

const { isApiAuthenticated, requireAuth } = await import("@/lib/api-helpers");

describe("api auth helpers", () => {
  beforeEach(() => {
    authMock.mockReset();
    delete process.env.ALLOWED_EMAIL;
  });

  it("isApiAuthenticated is false without a session", async () => {
    authMock.mockResolvedValue(null);

    await expect(isApiAuthenticated()).resolves.toBe(false);
  });

  it("isApiAuthenticated is false for non-owner when ALLOWED_EMAIL is set", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    authMock.mockResolvedValue({
      user: { email: "viewer@example.com" },
    });

    await expect(isApiAuthenticated()).resolves.toBe(false);
  });

  it("isApiAuthenticated is true for owner session", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    authMock.mockResolvedValue({
      user: { email: "owner@example.com" },
    });

    await expect(isApiAuthenticated()).resolves.toBe(true);
  });

  it("requireAuth returns 401 when no session exists", async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/documents");
    const res = await requireAuth(req);

    expect(res?.status).toBe(401);
  });

  it("requireAuth returns 403 for signed-in non-owner", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    authMock.mockResolvedValue({
      user: { email: "viewer@example.com" },
    });

    const req = new NextRequest("http://localhost:3000/api/documents");
    const res = await requireAuth(req);

    expect(res?.status).toBe(403);
  });

  it("requireAuth returns null for owner", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    authMock.mockResolvedValue({
      user: { email: "owner@example.com" },
    });

    const req = new NextRequest("http://localhost:3000/api/documents");
    const res = await requireAuth(req);

    expect(res).toBeNull();
  });
});
